-- Apply after 20260918000000_newspi_game_state.sql.
-- Existing economy and market functions remain unchanged.
create table if not exists public.long_short_bets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null references public.market_assets(id),
  direction text not null check (direction in ('LONG', 'SHORT')),
  stake integer not null check (stake > 0),
  entry_price numeric(12,2) not null check (entry_price > 0),
  exit_price numeric(12,2) check (exit_price > 0),
  payout integer check (payout >= 0),
  status text not null default 'OPEN' check (status in ('OPEN', 'WON', 'LOST', 'DRAW')),
  opened_at timestamptz not null default now(),
  expires_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint long_short_settlement_complete check (
    (status = 'OPEN' and exit_price is null and payout is null and settled_at is null)
    or (status <> 'OPEN' and exit_price is not null and payout is not null and settled_at is not null)
  )
);
create unique index if not exists long_short_request_unique
  on public.long_short_bets (user_id, request_id);
create unique index if not exists long_short_one_open_per_user
  on public.long_short_bets (user_id) where status = 'OPEN';
create index if not exists long_short_recent_per_user
  on public.long_short_bets (user_id, settled_at desc) where status <> 'OPEN';

alter table public.long_short_bets enable row level security;
drop policy if exists long_short_select_own on public.long_short_bets;
create policy long_short_select_own on public.long_short_bets
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.long_short_bets from anon, authenticated;
grant select on public.long_short_bets to authenticated;

-- The profile row serializes this action with every existing game action.
-- The existing tick RPC calculates server prices before opening/settling.
create or replace function public.newspi_long_short_action(
  p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_tick jsonb;
  v_state jsonb;
  v_bet public.long_short_bets%rowtype;
  v_settled jsonb := null;
  v_active jsonb := null;
  v_recent jsonb := '[]'::jsonb;
  v_asset text;
  v_direction text;
  v_choice text;
  v_stake integer;
  v_coins numeric;
  v_entry numeric;
  v_exit numeric;
  v_status text;
  v_payout integer;
  v_opened timestamptz;
  v_request uuid;
  v_now timestamptz;
  v_message text := '';
  v_applied boolean := false;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_action not in ('status', 'open') then
    return jsonb_build_object('ok', false, 'message', '지원하지 않는 예측 요청입니다.');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then p_payload := '{}'::jsonb; end if;

  v_tick := public.newspi_game_action('tick', '{}'::jsonb);
  if coalesce((v_tick->>'ok')::boolean, false) = false then
    return jsonb_build_object('ok', false, 'message', '게임 상태를 먼저 불러와 주세요.');
  end if;
  select game_state into v_state from public.profiles where id = v_user for update;
  v_now := clock_timestamp();

  -- Conditional update and the profile lock prevent duplicate payouts.
  select * into v_bet from public.long_short_bets
    where user_id = v_user and status = 'OPEN' for update;
  if found and v_bet.expires_at <= v_now then
    v_exit := (v_state->'market'->v_bet.asset_id->>'currentPrice')::numeric;
    if v_exit = v_bet.entry_price then v_status := 'DRAW';
    elsif (v_exit > v_bet.entry_price and v_bet.direction = 'LONG')
       or (v_exit < v_bet.entry_price and v_bet.direction = 'SHORT') then v_status := 'WON';
    else v_status := 'LOST'; end if;
    v_payout := case v_status when 'WON' then floor(v_bet.stake::numeric * 1.8)::integer
      when 'DRAW' then v_bet.stake else 0 end;
    update public.long_short_bets set status = v_status, exit_price = v_exit,
      payout = v_payout, settled_at = v_now
      where id = v_bet.id and status = 'OPEN';
    if found then
      v_state := jsonb_set(v_state, '{coins}',
        to_jsonb((v_state->>'coins')::numeric + v_payout));
      perform public.newspi_sync_state(v_user, v_state);
      select to_jsonb(b) into v_settled from public.long_short_bets b where b.id = v_bet.id;
      v_applied := true;
    end if;
  end if;

  if p_action = 'open' then
    begin v_request := (p_payload->>'requestId')::uuid;
    exception when others then v_request := null; end;
    v_asset := p_payload->>'assetId';
    v_direction := p_payload->>'direction';
    v_choice := p_payload->>'stakeChoice';
    v_coins := (v_state->>'coins')::numeric;
    if v_request is null then
      v_message := '예측 요청을 확인할 수 없습니다.';
    elsif exists (select 1 from public.long_short_bets where user_id = v_user and request_id = v_request) then
      v_message := '이미 처리된 예측 요청입니다.';
    elsif exists (select 1 from public.long_short_bets where user_id = v_user and status = 'OPEN') then
      v_message := '이미 진행 중인 롱·숏 베팅이 있습니다.';
    elsif coalesce(v_asset,'') not in ('AI_TECH','SEMICONDUCTOR','ECONOMY','GLOBAL','SOCIETY','CULTURE','SPORTS')
      or coalesce(v_direction,'') not in ('LONG','SHORT')
      or coalesce(v_choice,'') not in ('10','25','50','MAX') then
      v_message := '이슈, 방향, 베팅 금액을 확인해 주세요.';
    else
      v_stake := case v_choice when 'MAX' then floor(v_coins)::integer else v_choice::integer end;
      if v_stake < 1 or v_stake > v_coins then
        v_message := '보유 코인이 부족합니다.';
      else
        v_entry := (v_state->'market'->v_asset->>'currentPrice')::numeric;
        v_opened := clock_timestamp();
        insert into public.long_short_bets
          (user_id, request_id, asset_id, direction, stake, entry_price, opened_at, expires_at)
        values (v_user, v_request, v_asset, v_direction, v_stake, v_entry,
          v_opened, v_opened + interval '60 seconds');
        v_state := jsonb_set(v_state, '{coins}', to_jsonb(v_coins - v_stake));
        perform public.newspi_sync_state(v_user, v_state);
        update public.profiles set has_game_activity = true where id = v_user;
        v_applied := true;
      end if;
    end if;
  end if;

  select to_jsonb(b) into v_active from public.long_short_bets b
    where b.user_id = v_user and b.status = 'OPEN' limit 1;
  select coalesce(jsonb_agg(to_jsonb(recent) order by recent.settled_at desc), '[]'::jsonb)
    into v_recent from (
      select id, user_id, request_id, asset_id, direction, stake, entry_price, exit_price,
        payout, status, opened_at, expires_at, settled_at
      from public.long_short_bets where user_id = v_user and status <> 'OPEN'
      order by settled_at desc limit 10
    ) recent;
  return jsonb_build_object('ok', v_message = '', 'message', v_message,
    'applied', v_applied, 'state', v_state, 'serverNow',
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    'activeBet', v_active, 'recentBets', v_recent, 'settledBet', v_settled);
end;
$$;
revoke all on function public.newspi_long_short_action(text,jsonb) from public, anon;
grant execute on function public.newspi_long_short_action(text,jsonb) to authenticated;

-- Reset the new table in the same transaction as the existing game reset.
create or replace function public.newspi_reset_with_bets() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_result := public.newspi_game_action('reset', '{}'::jsonb);
  if coalesce((v_result->>'ok')::boolean, false) then
    delete from public.long_short_bets where user_id = v_user;
  end if;
  return v_result;
end;
$$;
revoke all on function public.newspi_reset_with_bets() from public, anon;
grant execute on function public.newspi_reset_with_bets() to authenticated;

-- Route all existing game actions through this dispatcher so a direct reset
-- cannot leave an OPEN bet behind. No game action rules are changed.
create or replace function public.newspi_game_dispatch(
  p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_action = 'reset' then return public.newspi_reset_with_bets(); end if;
  return public.newspi_game_action(p_action, p_payload);
end;
$$;
revoke all on function public.newspi_game_action(text,jsonb) from public, anon, authenticated;
revoke all on function public.newspi_game_dispatch(text,jsonb) from public, anon;
grant execute on function public.newspi_game_dispatch(text,jsonb) to authenticated;

-- Make the newly added RPC visible to Supabase's Data API immediately.
notify pgrst, 'reload schema';
