-- Economy tuning: 20 C initial balance, 5 C roulette, diversified asset
-- prices, and wider one-minute market movement. Existing user state is kept;
-- the new defaults are used for new users and explicit game resets.

update public.market_assets as asset
set base_price = values_table.base_price
from (values
  ('AI_TECH', 620::numeric),
  ('SEMICONDUCTOR', 1480::numeric),
  ('ECONOMY', 180::numeric),
  ('GLOBAL', 360::numeric),
  ('SOCIETY', 28::numeric),
  ('CULTURE', 72::numeric),
  ('SPORTS', 12::numeric)
) as values_table(id, base_price)
where asset.id = values_table.id;

alter table public.profiles alter column coins set default 20;

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
    'quizCurrentStreak', 0, 'totalNewsCoinsEarned', 0);
end;
$$;

-- Keep the existing action implementation and its locking/idempotency rules.
-- Patch only the three configured economy constants so every caller,
-- including the long/short RPC, uses the same server-side rules.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.newspi_game_action(text,jsonb)'::regprocedure)
    into v_definition;

  v_definition := replace(v_definition,
    'elsif v_coins < 10 then v_message := ''룰렛에는 10 C가 필요합니다.'';',
    'elsif v_coins < 5 then v_message := ''룰렛에는 5 C가 필요합니다.'';');
  v_definition := replace(v_definition,
    'jsonb_set(v_state,''{coins}'',to_jsonb(v_coins - 10))',
    'jsonb_set(v_state,''{coins}'',to_jsonb(v_coins - 5))');
  v_definition := replace(v_definition,
    'jsonb_set(v_state,''{coins}'',to_jsonb(v_coins + 10))',
    'jsonb_set(v_state,''{coins}'',to_jsonb(v_coins + 5))');
  v_definition := replace(v_definition,
    'v_rate := (random() - 0.5) * 0.01;',
    'v_rate := (random() * 2 - 1) * 0.03;');

  if position('룰렛에는 5 C가 필요합니다.' in v_definition) = 0
    or position('v_coins - 5' in v_definition) = 0
    or position('v_coins + 5' in v_definition) = 0
    or position('(random() * 2 - 1) * 0.03' in v_definition) = 0 then
    raise exception 'NEWSPI economy constants could not be updated safely';
  end if;

  execute v_definition;
end;
$migration$;

-- Supersede the earlier temporary 20 C dispatcher while preserving the
-- atomic reset that also clears long/short bets.
create or replace function public.newspi_game_dispatch(
  p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_action = 'reset' then return public.newspi_reset_with_bets(); end if;
  return public.newspi_game_action(p_action, p_payload);
end;
$$;

revoke all on function public.newspi_initial_state() from public, anon, authenticated;
revoke all on function public.newspi_game_action(text,jsonb) from public, anon, authenticated;
revoke all on function public.newspi_game_dispatch(text,jsonb) from public, anon;
grant execute on function public.newspi_game_dispatch(text,jsonb) to authenticated;

notify pgrst, 'reload schema';
