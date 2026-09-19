-- Quiz reward rebalance and atomic coin shop.
-- Apply after 20260920010000_newspi_economy_tuning.sql.

create or replace function public.newspi_initial_state() returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  v_market jsonb := '{}'::jsonb;
  v_holdings jsonb := '{}'::jsonb;
  v_asset record;
  v_history jsonb;
  v_base numeric;
begin
  for v_asset in select id, base_price from public.market_assets order by sort_order loop
    v_base := v_asset.base_price;
    v_history := jsonb_build_array(round(v_base * 0.92), round(v_base * 0.96), round(v_base * 0.95),
      round(v_base * 1.01), round(v_base * 0.98), v_base);
    v_market := jsonb_set(v_market, array[v_asset.id], jsonb_build_object(
      'currentPrice', v_base, 'previousPrice', v_base, 'priceHistory', v_history));
    v_holdings := jsonb_set(v_holdings, array[v_asset.id], '{"quantity":0,"averagePrice":0}'::jsonb);
  end loop;
  return jsonb_build_object(
    'version', 2, 'coins', 20, 'happyTypingCount', 0, 'happyDailyDate', public.newspi_date_key(),
    'happyDailyEarned', 0, 'holdings', v_holdings, 'completedQuizIds', '[]'::jsonb,
    'quizAttempts', '{}'::jsonb, 'seenNewsIds', '[]'::jsonb, 'cachedAnalyses', '{}'::jsonb,
    'analysisCacheOrder', '[]'::jsonb,
    'currentDay', 0, 'market', v_market,
    'nextMarketTickAt', floor(extract(epoch from clock_timestamp()) * 1000)::bigint + 60000,
    'marketTickCount', 0, 'processedImpactIds', '[]'::jsonb, 'newsHistory', '[]'::jsonb,
    'hackEvents', '{}'::jsonb, 'hackNormalStreak', 0,
    'dailyMission', jsonb_build_object('date', public.newspi_date_key(),
      'readArticleIds', '[]'::jsonb, 'quizStreak', 0, 'predictedArticleIds', '[]'::jsonb,
      'claimed', '{"explorer":false,"streak":false,"hacker":false}'::jsonb, 'allClaimed', false),
    'quizCurrentStreak', 0, 'totalNewsCoinsEarned', 0,
    'ownedShopItems', '[]'::jsonb, 'equippedTitle', null, 'equippedTheme', null);
end;
$$;

-- Add shop fields without changing any existing coins, holdings, or progress.
update public.profiles set game_state = jsonb_set(game_state, '{ownedShopItems}', '[]'::jsonb)
where not (game_state ? 'ownedShopItems');
update public.profiles set game_state = jsonb_set(game_state, '{equippedTitle}', 'null'::jsonb)
where not (game_state ? 'equippedTitle');
update public.profiles set game_state = jsonb_set(game_state, '{equippedTheme}', 'null'::jsonb)
where not (game_state ? 'equippedTheme');

-- Preserve the original quiz validation and idempotency, changing only the
-- two server-authoritative reward constants.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.newspi_game_action(text,jsonb)'::regprocedure)
    into v_definition;
  v_definition := replace(v_definition,
    'v_reward := case when v_attempts = 0 then 25 else 10 end;',
    'v_reward := case when v_attempts = 0 then 100 else 50 end;');
  if position('v_reward := case when v_attempts = 0 then 100 else 50 end;' in v_definition) = 0 then
    raise exception 'NEWSPI quiz rewards could not be updated safely';
  end if;
  execute v_definition;
end;
$migration$;

create or replace function public.newspi_shop_action(
  p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_state jsonb;
  v_owned jsonb;
  v_item text := p_payload->>'itemId';
  v_kind text;
  v_price integer;
  v_coins numeric;
  v_message text := '';
  v_applied boolean := false;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_action not in ('shop_purchase', 'shop_equip') or p_payload is null
    or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok',false,'message','상점 요청을 확인할 수 없습니다.','applied',false);
  end if;

  select * into v_profile from public.profiles where id = v_user for update;
  if not found then
    return jsonb_build_object('ok',false,'message','게임 상태를 먼저 불러와 주세요.','applied',false);
  end if;
  if v_profile.local_migration_completed_at is null then
    return jsonb_build_object('ok',false,'message','기존 데이터 이전을 완료한 뒤 다시 시도해 주세요.',
      'applied',false,'state',v_profile.game_state,'migrationCompleted',false);
  end if;

  v_state := v_profile.game_state;
  v_owned := case when jsonb_typeof(v_state->'ownedShopItems') = 'array'
    then v_state->'ownedShopItems' else '[]'::jsonb end;
  v_coins := (v_state->>'coins')::numeric;

  case v_item
    when 'TITLE_NEWS_SCOUT' then v_kind := 'TITLE'; v_price := 300;
    when 'TITLE_ISSUE_HUNTER' then v_kind := 'TITLE'; v_price := 700;
    when 'TITLE_MARKET_ORACLE' then v_kind := 'TITLE'; v_price := 1500;
    when 'THEME_VIOLET' then v_kind := 'THEME'; v_price := 600;
    when 'THEME_GOLD' then v_kind := 'THEME'; v_price := 1200;
    when 'THEME_AURORA' then v_kind := 'THEME'; v_price := 2500;
    else v_message := '존재하지 않는 상품입니다.';
  end case;

  if v_message = '' and p_action = 'shop_purchase' then
    if v_owned ? v_item then
      v_message := '이미 보유한 상품입니다.';
    elsif v_coins < v_price then
      v_message := '보유 코인이 부족합니다.';
    else
      v_state := jsonb_set(v_state, '{coins}', to_jsonb(v_coins - v_price));
      v_state := jsonb_set(v_state, '{ownedShopItems}', v_owned || jsonb_build_array(v_item));
      v_message := '구매했습니다. 보관함에서 장착할 수 있어요.';
      v_applied := true;
    end if;
  elsif v_message = '' and p_action = 'shop_equip' then
    if not (v_owned ? v_item) then
      v_message := '먼저 상품을 구매해 주세요.';
    elsif (v_kind = 'TITLE' and v_state->>'equippedTitle' = v_item)
       or (v_kind = 'THEME' and v_state->>'equippedTheme' = v_item) then
      v_message := '이미 장착 중인 상품입니다.';
    else
      if v_kind = 'TITLE' then
        v_state := jsonb_set(v_state, '{equippedTitle}', to_jsonb(v_item));
      else
        v_state := jsonb_set(v_state, '{equippedTheme}', to_jsonb(v_item));
      end if;
      v_message := '새 아이템을 장착했습니다.';
      v_applied := true;
    end if;
  end if;

  if v_applied then
    perform public.newspi_sync_state(v_user, v_state);
    update public.profiles set has_game_activity = true where id = v_user;
  end if;
  return jsonb_build_object('ok',v_applied,'message',v_message,'applied',v_applied,
    'state',v_state,'migrationCompleted',true);
end;
$$;

create or replace function public.newspi_game_dispatch(
  p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_action = 'reset' then return public.newspi_reset_with_bets(); end if;
  if p_action in ('shop_purchase','shop_equip') then
    return public.newspi_shop_action(p_action, p_payload);
  end if;
  return public.newspi_game_action(p_action, p_payload);
end;
$$;

revoke all on function public.newspi_initial_state() from public, anon, authenticated;
revoke all on function public.newspi_game_action(text,jsonb) from public, anon, authenticated;
revoke all on function public.newspi_shop_action(text,jsonb) from public, anon, authenticated;
revoke all on function public.newspi_game_dispatch(text,jsonb) from public, anon;
grant execute on function public.newspi_game_dispatch(text,jsonb) to authenticated;

notify pgrst, 'reload schema';
