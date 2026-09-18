-- NEWSPI: run once in the Supabase SQL editor or with `supabase db push`.
-- The canonical game_state lives in profiles. The other tables are transactionally
-- maintained projections for inspection, constraints, and future queries.
create table if not exists public.market_assets (
  id text primary key,
  name text not null,
  base_price numeric(12,2) not null check (base_price > 0),
  sort_order integer not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.happy_phrases (
  phrase_index integer primary key,
  phrase text not null
);
insert into public.happy_phrases (phrase_index, phrase) values
  (0, '오늘의 내가 조금 느리게 걷고 있어도 괜찮아요. 멈추지 않고 여기까지 온 것만으로도 충분히 잘하고 있어요.'),
  (1, '잘한 일이 떠오르지 않는 날에도 나를 함부로 대하지 않을 거예요. 쉬어 가는 시간 역시 앞으로 가는 과정이에요.'),
  (2, '모든 답을 지금 알 필요는 없어요. 작은 질문 하나를 붙잡고 천천히 배우는 나를 믿어 주세요.'),
  (3, '누군가와 나를 비교하느라 마음이 지쳤다면 잠시 숨을 골라요. 내 속도로 쌓은 하루에도 분명한 가치가 있어요.'),
  (4, '실수한 하루가 나의 전부를 설명하지는 않아요. 다시 시작할 수 있는 용기를 나에게 먼저 건네볼게요.'),
  (5, '기분이 흐린 날에는 밝아지려고 애쓰지 않아도 돼요. 지금의 마음을 살피는 일부터 시작해도 괜찮아요.')
on conflict (phrase_index) do nothing;

insert into public.market_assets (id, name, base_price, sort_order) values
  ('AI_TECH', 'AI 기술 지수', 142, 1),
  ('SEMICONDUCTOR', '반도체 산업 지수', 118, 2),
  ('ECONOMY', '경제·금융 지수', 96, 3),
  ('GLOBAL', '글로벌 이슈 지수', 105, 4),
  ('SOCIETY', '사회 이슈 지수', 84, 5),
  ('CULTURE', '문화·콘텐츠 지수', 110, 6),
  ('SPORTS', '스포츠 지수', 77, 7)
on conflict (id) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  coins numeric(12,2) not null default 100 check (coins >= 0),
  total_earned numeric(12,2) not null default 0 check (total_earned >= 0),
  current_quiz_streak integer not null default 0 check (current_quiz_streak >= 0),
  game_state jsonb not null,
  revision bigint not null default 0,
  has_game_activity boolean not null default false,
  local_migration_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_market_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null references public.market_assets(id),
  current_price numeric(12,2) not null check (current_price > 0),
  previous_price numeric(12,2) not null check (previous_price > 0),
  price_history jsonb not null default '[]'::jsonb,
  last_tick_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, asset_id)
);

create table if not exists public.positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null references public.market_assets(id),
  quantity integer not null default 0 check (quantity >= 0),
  average_buy_price numeric(14,4) not null default 0 check (average_buy_price >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, asset_id)
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null references public.market_assets(id),
  trade_type text not null check (trade_type in ('BUY', 'SELL')),
  quantity integer not null check (quantity > 0),
  price numeric(12,2) not null check (price > 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists trades_user_time_idx on public.trades (user_id, created_at desc);

create table if not exists public.news_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  title text not null,
  category text,
  source text,
  published_at text,
  viewed_at timestamptz not null,
  original_link text,
  summary jsonb not null default '[]'::jsonb,
  importance text not null default '',
  is_live boolean not null default false,
  quiz_answered boolean not null default false,
  quiz_correct boolean not null default false,
  quiz_attempts integer not null default 0 check (quiz_attempts >= 0),
  quiz_reward integer not null default 0 check (quiz_reward >= 0),
  hack_event boolean not null default false,
  prediction jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, article_id)
);
create index if not exists news_history_user_viewed_idx on public.news_history (user_id, viewed_at desc);

create table if not exists public.article_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  quiz_reward_claimed boolean not null default false,
  quiz_attempts integer not null default 0,
  hack_event_decided boolean not null default false,
  hack_event_settled boolean not null default false,
  market_impact_applied boolean not null default false,
  mission_news_read boolean not null default false,
  mission_hack_predicted boolean not null default false,
  hack_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists public.roulette_spins (
  user_id uuid not null references auth.users(id) on delete cascade,
  spin_id uuid not null,
  refunded boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, spin_id)
);

create table if not exists public.daily_missions (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_date date not null,
  read_article_ids jsonb not null default '[]'::jsonb,
  quiz_streak_count integer not null default 0 check (quiz_streak_count >= 0),
  predicted_article_ids jsonb not null default '[]'::jsonb,
  news_mission_claimed boolean not null default false,
  quiz_mission_claimed boolean not null default false,
  hack_mission_claimed boolean not null default false,
  all_complete_bonus_claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_date)
);

create table if not exists public.daily_relief_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  relief_date date not null,
  earned_coins integer not null default 0 check (earned_coins between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, relief_date)
);

-- Direct writes are revoked. The authenticated RPC below checks auth.uid(),
-- locks the user's profile row, and updates all projections in one transaction.
alter table public.profiles enable row level security;
alter table public.user_market_states enable row level security;
alter table public.positions enable row level security;
alter table public.trades enable row level security;
alter table public.news_history enable row level security;
alter table public.article_progress enable row level security;
alter table public.roulette_spins enable row level security;
alter table public.daily_missions enable row level security;
alter table public.daily_relief_progress enable row level security;
alter table public.market_assets enable row level security;
alter table public.happy_phrases enable row level security;

create policy profiles_own_read on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy market_own_read on public.user_market_states for select to authenticated using ((select auth.uid()) = user_id);
create policy positions_own_read on public.positions for select to authenticated using ((select auth.uid()) = user_id);
create policy trades_own_read on public.trades for select to authenticated using ((select auth.uid()) = user_id);
create policy history_own_read on public.news_history for select to authenticated using ((select auth.uid()) = user_id);
create policy progress_own_read on public.article_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy spins_own_read on public.roulette_spins for select to authenticated using ((select auth.uid()) = user_id);
create policy missions_own_read on public.daily_missions for select to authenticated using ((select auth.uid()) = user_id);
create policy relief_own_read on public.daily_relief_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy assets_authenticated_read on public.market_assets for select to authenticated using (true);
create policy phrases_authenticated_read on public.happy_phrases for select to authenticated using (true);

revoke all on public.profiles, public.user_market_states, public.positions, public.trades,
  public.news_history, public.article_progress, public.roulette_spins,
  public.daily_missions, public.daily_relief_progress, public.market_assets from anon, authenticated;
revoke all on public.happy_phrases from anon, authenticated;
grant select on public.profiles, public.user_market_states, public.positions, public.trades,
  public.news_history, public.article_progress, public.roulette_spins,
  public.daily_missions, public.daily_relief_progress, public.market_assets to authenticated;
grant select on public.happy_phrases to authenticated;

create or replace function public.newspi_date_key() returns text
language sql stable set search_path = '' as $$
  select to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD');
$$;

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
    'version', 2, 'coins', 100, 'happyTypingCount', 0, 'happyDailyDate', public.newspi_date_key(),
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

create or replace function public.newspi_valid_import(p_state jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v_id text;
  v_item jsonb;
  v_entry jsonb;
begin
  if jsonb_typeof(p_state) <> 'object' or jsonb_typeof(p_state->'coins') <> 'number'
    or (p_state->>'coins')::numeric < 0 or (p_state->>'coins')::numeric > 1000000000
    or jsonb_typeof(p_state->'holdings') <> 'object'
    or jsonb_typeof(p_state->'market') <> 'object'
    or jsonb_typeof(p_state->'newsHistory') <> 'array'
    or jsonb_array_length(p_state->'newsHistory') > 100
    or jsonb_typeof(p_state->'dailyMission') <> 'object'
    or jsonb_typeof(p_state->'dailyMission'->'claimed') <> 'object'
    or jsonb_typeof(p_state->'dailyMission'->'claimed'->'explorer') <> 'boolean'
    or jsonb_typeof(p_state->'dailyMission'->'claimed'->'streak') <> 'boolean'
    or jsonb_typeof(p_state->'dailyMission'->'claimed'->'hacker') <> 'boolean'
    or jsonb_typeof(p_state->'dailyMission'->'allClaimed') <> 'boolean'
    or jsonb_typeof(p_state->'happyDailyEarned') <> 'number'
    or (p_state->>'happyDailyEarned')::integer not between 0 and 10 then return false; end if;
  for v_id, v_item in select key, value from jsonb_each(p_state->'holdings') loop
    if v_id is null or v_id not in ('AI_TECH','SEMICONDUCTOR','ECONOMY','GLOBAL','SOCIETY','CULTURE','SPORTS')
      or jsonb_typeof(v_item->'quantity') <> 'number' or (v_item->>'quantity')::numeric < 0
      or (v_item->>'quantity')::numeric <> trunc((v_item->>'quantity')::numeric)
      or jsonb_typeof(v_item->'averagePrice') <> 'number' or (v_item->>'averagePrice')::numeric < 0 then return false; end if;
  end loop;
  for v_id, v_item in select key, value from jsonb_each(p_state->'market') loop
    if v_id not in ('AI_TECH','SEMICONDUCTOR','ECONOMY','GLOBAL','SOCIETY','CULTURE','SPORTS')
      or jsonb_typeof(v_item->'currentPrice') <> 'number' or (v_item->>'currentPrice')::numeric <= 0
      or jsonb_typeof(v_item->'previousPrice') <> 'number' or (v_item->>'previousPrice')::numeric <= 0
      or jsonb_typeof(v_item->'priceHistory') <> 'array'
      or jsonb_array_length(v_item->'priceHistory') not between 1 and 60 then return false; end if;
    for v_entry in select value from jsonb_array_elements(v_item->'priceHistory') loop
      if jsonb_typeof(v_entry) <> 'number' or (v_entry #>> '{}')::numeric <= 0 then return false; end if;
    end loop;
  end loop;
  for v_entry in select value from jsonb_array_elements(p_state->'newsHistory') loop
    if length(coalesce(v_entry->>'articleId','')) not between 1 and 300
      or length(coalesce(v_entry->>'originalLink','')) > 1000
      or coalesce(v_entry->>'originalLink','') !~* '^https?://'
      or jsonb_typeof(v_entry->'isLive') <> 'boolean'
      or jsonb_typeof(v_entry->'quizAnswered') <> 'boolean'
      or jsonb_typeof(v_entry->'quizCorrect') <> 'boolean'
      or jsonb_typeof(v_entry->'hackEvent') <> 'boolean' then return false; end if;
    if v_entry ? 'prediction' and (v_entry->'prediction'->>'selectedIssue') not in
      ('AI_TECH','SEMICONDUCTOR','ECONOMY','GLOBAL','SOCIETY','CULTURE','SPORTS') then return false; end if;
    if v_entry ? 'prediction' and (v_entry->'prediction'->>'selectedDirection') not in
      ('UP','NEUTRAL','DOWN') then return false; end if;
    if v_entry ? 'prediction' and (v_entry->'prediction'->>'result') not in
      ('EXACT','DIRECTION_ONLY','MISS') then return false; end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.newspi_sync_state(p_user uuid, p_state jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_asset record;
  v_item jsonb;
  v_id text;
  v_daily jsonb := p_state->'dailyMission';
begin
  update public.profiles set
    game_state = p_state,
    coins = (p_state->>'coins')::numeric,
    total_earned = greatest(0, coalesce((p_state->>'totalNewsCoinsEarned')::numeric, 0)),
    current_quiz_streak = coalesce((p_state->>'quizCurrentStreak')::integer, 0),
    revision = revision + 1,
    updated_at = now()
  where id = p_user;

  for v_asset in select id from public.market_assets order by sort_order loop
    v_item := p_state->'market'->v_asset.id;
    insert into public.user_market_states (user_id, asset_id, current_price, previous_price, price_history, last_tick_at)
    values (p_user, v_asset.id, (v_item->>'currentPrice')::numeric,
      (v_item->>'previousPrice')::numeric, v_item->'priceHistory',
      to_timestamp(((p_state->>'nextMarketTickAt')::numeric - 60000) / 1000))
    on conflict (user_id, asset_id) do update set
      current_price = excluded.current_price, previous_price = excluded.previous_price,
      price_history = excluded.price_history, last_tick_at = excluded.last_tick_at, updated_at = now();
    v_item := p_state->'holdings'->v_asset.id;
    insert into public.positions (user_id, asset_id, quantity, average_buy_price)
    values (p_user, v_asset.id, (v_item->>'quantity')::integer, (v_item->>'averagePrice')::numeric)
    on conflict (user_id, asset_id) do update set
      quantity = excluded.quantity, average_buy_price = excluded.average_buy_price, updated_at = now();
  end loop;

  for v_item in select value from jsonb_array_elements(p_state->'newsHistory') loop
    insert into public.news_history (user_id, article_id, title, category, source, published_at,
      viewed_at, original_link, summary, importance, is_live, quiz_answered, quiz_correct,
      quiz_attempts, quiz_reward, hack_event, prediction)
    values (p_user, v_item->>'articleId', v_item->>'title', v_item->>'category', v_item->>'source',
      v_item->>'publishedAt', coalesce(nullif(v_item->>'viewedAt','')::timestamptz, now()),
      v_item->>'originalLink', coalesce(v_item->'summary','[]'::jsonb), v_item->>'importance',
      coalesce((v_item->>'isLive')::boolean,false), coalesce((v_item->>'quizAnswered')::boolean,false),
      coalesce((v_item->>'quizCorrect')::boolean,false), coalesce((v_item->>'quizAttempts')::integer,0),
      coalesce((v_item->>'quizReward')::integer,0), coalesce((v_item->>'hackEvent')::boolean,false), v_item->'prediction')
    on conflict (user_id, article_id) do update set
      title = excluded.title, category = excluded.category, source = excluded.source,
      published_at = excluded.published_at, viewed_at = excluded.viewed_at,
      original_link = excluded.original_link, summary = excluded.summary, importance = excluded.importance,
      is_live = excluded.is_live, quiz_answered = excluded.quiz_answered,
      quiz_correct = excluded.quiz_correct, quiz_attempts = excluded.quiz_attempts,
      quiz_reward = excluded.quiz_reward, hack_event = excluded.hack_event,
      prediction = excluded.prediction, updated_at = now();
  end loop;
  delete from public.news_history where user_id = p_user and article_id not in
    (select value->>'articleId' from jsonb_array_elements(p_state->'newsHistory'));

  for v_id in
    select distinct article_id from (
      select value as article_id from jsonb_array_elements_text(p_state->'completedQuizIds')
      union all select key from jsonb_each(p_state->'quizAttempts')
      union all select key from jsonb_each(p_state->'hackEvents')
      union all select value from jsonb_array_elements_text(p_state->'processedImpactIds')
      union all select value from jsonb_array_elements_text(p_state->'seenNewsIds')
    ) ids
  loop
    insert into public.article_progress (user_id, article_id, quiz_reward_claimed, quiz_attempts,
      hack_event_decided, hack_event_settled, market_impact_applied, mission_news_read,
      mission_hack_predicted, hack_state)
    values (p_user, v_id, p_state->'completedQuizIds' ? v_id,
      coalesce((p_state->'quizAttempts'->>v_id)::integer,0), p_state->'hackEvents' ? v_id,
      coalesce((p_state->'hackEvents'->v_id->>'resolved')::boolean,false),
      p_state->'processedImpactIds' ? v_id,
      p_state->'dailyMission'->'readArticleIds' ? v_id,
      p_state->'dailyMission'->'predictedArticleIds' ? v_id,
      p_state->'hackEvents'->v_id)
    on conflict (user_id, article_id) do update set
      quiz_reward_claimed = excluded.quiz_reward_claimed, quiz_attempts = excluded.quiz_attempts,
      hack_event_decided = excluded.hack_event_decided, hack_event_settled = excluded.hack_event_settled,
      market_impact_applied = excluded.market_impact_applied,
      mission_news_read = excluded.mission_news_read,
      mission_hack_predicted = excluded.mission_hack_predicted,
      hack_state = excluded.hack_state,
      updated_at = now();
  end loop;

  insert into public.daily_missions (user_id, mission_date, read_article_ids, quiz_streak_count,
    predicted_article_ids, news_mission_claimed, quiz_mission_claimed, hack_mission_claimed,
    all_complete_bonus_claimed)
  values (p_user, (v_daily->>'date')::date, v_daily->'readArticleIds',
    (v_daily->>'quizStreak')::integer, v_daily->'predictedArticleIds',
    (v_daily->'claimed'->>'explorer')::boolean, (v_daily->'claimed'->>'streak')::boolean,
    (v_daily->'claimed'->>'hacker')::boolean, (v_daily->>'allClaimed')::boolean)
  on conflict (user_id, mission_date) do update set
    read_article_ids = excluded.read_article_ids, quiz_streak_count = excluded.quiz_streak_count,
    predicted_article_ids = excluded.predicted_article_ids,
    news_mission_claimed = excluded.news_mission_claimed,
    quiz_mission_claimed = excluded.quiz_mission_claimed,
    hack_mission_claimed = excluded.hack_mission_claimed,
    all_complete_bonus_claimed = excluded.all_complete_bonus_claimed, updated_at = now();

  insert into public.daily_relief_progress (user_id, relief_date, earned_coins)
  values (p_user, (p_state->>'happyDailyDate')::date, (p_state->>'happyDailyEarned')::integer)
  on conflict (user_id, relief_date) do update set earned_coins = excluded.earned_coins, updated_at = now();
end;
$$;

create or replace function public.newspi_move_price(p_price jsonb, p_rate numeric) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_old numeric := (p_price->>'currentPrice')::numeric;
  v_step numeric;
  v_new numeric;
  v_history jsonb;
begin
  v_step := floor(v_old * abs(p_rate) * 100 + 0.000000001) / 100;
  v_new := greatest(10, round(v_old + sign(p_rate) * v_step, 2));
  select coalesce(jsonb_agg(value order by ord), '[]'::jsonb) into v_history
  from jsonb_array_elements((p_price->'priceHistory') || to_jsonb(v_new)) with ordinality as t(value, ord)
  where ord > greatest(0, jsonb_array_length((p_price->'priceHistory') || to_jsonb(v_new)) - 60);
  return jsonb_build_object('currentPrice', v_new, 'previousPrice', v_old, 'priceHistory', v_history);
end;
$$;

create or replace function public.newspi_apply_impact(p_state jsonb, p_article_id text, p_impact jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_id text := p_impact->>'relatedIssue';
  v_direction text := p_impact->>'direction';
  v_magnitude numeric := least(5, greatest(0.5, abs(coalesce((p_impact->>'magnitude')::numeric, 0.5))));
  v_rate numeric;
begin
  if p_state->'processedImpactIds' ? p_article_id then return p_state; end if;
  if not (p_state->'market' ? v_id) or v_direction not in ('UP','DOWN','NEUTRAL') then return p_state; end if;
  if v_direction <> 'NEUTRAL' then
    v_rate := case when v_direction = 'UP' then v_magnitude / 100 else -v_magnitude / 100 end;
    p_state := jsonb_set(p_state, array['market',v_id], public.newspi_move_price(p_state->'market'->v_id, v_rate));
  end if;
  return jsonb_set(p_state, '{processedImpactIds}', (p_state->'processedImpactIds') || to_jsonb(p_article_id));
end;
$$;

create or replace function public.newspi_history_patch(p_state jsonb, p_article_id text, p_patch jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_set(p_state, '{newsHistory}', coalesce(jsonb_agg(
    case when item->>'articleId' = p_article_id then item || p_patch else item end order by ord
  ), '[]'::jsonb))
  from jsonb_array_elements(p_state->'newsHistory') with ordinality as history(item, ord);
$$;

create or replace function public.newspi_game_action(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_state jsonb;
  v_before jsonb;
  v_profile public.profiles%rowtype;
  v_date text := public.newspi_date_key();
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_article_id text := p_payload->>'articleId';
  v_id text := p_payload->>'assetId';
  v_amount integer;
  v_coins numeric;
  v_price numeric;
  v_cost numeric;
  v_quantity integer;
  v_holding jsonb;
  v_event jsonb;
  v_analysis jsonb;
  v_impact jsonb;
  v_daily jsonb;
  v_record jsonb;
  v_history jsonb;
  v_read_ids jsonb;
  v_seen jsonb;
  v_list jsonb;
  v_prediction jsonb;
  v_result text;
  v_payout integer;
  v_reward integer;
  v_attempts integer;
  v_streak integer;
  v_target integer;
  v_spin_id uuid;
  v_refunded boolean;
  v_due integer;
  v_next_tick bigint;
  v_index integer;
  v_asset record;
  v_rate numeric;
  v_phrase text;
  v_applied boolean := false;
  v_message text := '';
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then p_payload := '{}'::jsonb; end if;
  insert into public.profiles (id, game_state) values (v_user, public.newspi_initial_state())
    on conflict (id) do nothing;
  select * into v_profile from public.profiles where id = v_user for update;
  v_state := v_profile.game_state;

  -- All daily limits use the server's Asia/Seoul date, never a client date.
  if v_state->'dailyMission'->>'date' <> v_date or v_state->>'happyDailyDate' <> v_date then
    if v_state->'dailyMission'->>'date' <> v_date then
      v_state := jsonb_set(v_state, '{dailyMission}', jsonb_build_object('date',v_date,
        'readArticleIds','[]'::jsonb,'quizStreak',0,'predictedArticleIds','[]'::jsonb,
        'claimed','{"explorer":false,"streak":false,"hacker":false}'::jsonb,'allClaimed',false));
    end if;
    v_state := v_state || jsonb_build_object('happyDailyDate',v_date,'happyDailyEarned',0);
    v_applied := true;
  end if;
  if v_profile.revision = 0 or v_applied then
    perform public.newspi_sync_state(v_user, v_state);
    v_applied := false;
  end if;

  if p_action = 'bootstrap' then
    return jsonb_build_object('ok',true,'state',v_state,
      'migrationCompleted',v_profile.local_migration_completed_at is not null);
  end if;

  if p_action = 'migrate' then
    if v_profile.local_migration_completed_at is not null then
      return jsonb_build_object('ok',true,'state',v_state,'migrationCompleted',true,'applied',false);
    end if;
    if not v_profile.has_game_activity then
      if pg_column_size(p_payload->'state') > 1000000 or not public.newspi_valid_import(p_payload->'state') then
        return jsonb_build_object('ok',false,'message','기존 데이터 형식을 확인할 수 없습니다. 로컬 데이터는 유지됩니다.','state',v_state);
      end if;
      v_state := p_payload->'state';
      -- Imported daily counters must not bypass the server date.
      if v_state->'dailyMission'->>'date' <> v_date then
        v_state := jsonb_set(v_state, '{dailyMission}', jsonb_build_object('date',v_date,
          'readArticleIds','[]'::jsonb,'quizStreak',0,'predictedArticleIds','[]'::jsonb,
          'claimed','{"explorer":false,"streak":false,"hacker":false}'::jsonb,'allClaimed',false));
      end if;
      if v_state->>'happyDailyDate' <> v_date then
        v_state := v_state || jsonb_build_object('happyDailyDate',v_date,'happyDailyEarned',0);
      end if;
      select coalesce(jsonb_agg(key),'[]'::jsonb) into v_list
      from jsonb_each(v_state->'cachedAnalyses');
      v_state := jsonb_set(v_state,'{analysisCacheOrder}',v_list);
      perform public.newspi_sync_state(v_user, v_state);
    end if;
    update public.profiles set local_migration_completed_at = now() where id = v_user;
    return jsonb_build_object('ok',true,'state',v_state,'migrationCompleted',true,'applied',not v_profile.has_game_activity);
  end if;

  if p_action = 'mark_migrated' then
    update public.profiles set local_migration_completed_at = coalesce(local_migration_completed_at,now()) where id = v_user;
    return jsonb_build_object('ok',true,'state',v_state,'migrationCompleted',true);
  end if;

  if v_profile.local_migration_completed_at is null then
    return jsonb_build_object('ok',false,'message','기존 데이터 이전을 완료한 뒤 다시 시도해 주세요.','state',v_state);
  end if;

  v_before := v_state;
  v_coins := (v_state->>'coins')::numeric;
  v_daily := v_state->'dailyMission';

  if p_action = 'reset' then
    v_state := public.newspi_initial_state();
    delete from public.trades where user_id = v_user;
    delete from public.roulette_spins where user_id = v_user;
    delete from public.article_progress where user_id = v_user;
    delete from public.news_history where user_id = v_user;
    delete from public.daily_missions where user_id = v_user;
    delete from public.daily_relief_progress where user_id = v_user;
    v_applied := true;

  elsif p_action = 'spend_roulette' then
    begin v_spin_id := (p_payload->>'spinId')::uuid; exception when others then v_spin_id := null; end;
    if v_spin_id is null then v_message := '룰렛 요청을 확인할 수 없습니다.';
    elsif exists (select 1 from public.roulette_spins where user_id = v_user and spin_id = v_spin_id) then
      v_message := '이미 처리된 룰렛입니다.';
    elsif v_coins < 10 then v_message := '룰렛에는 10 C가 필요합니다.';
    else
      insert into public.roulette_spins (user_id,spin_id) values (v_user,v_spin_id);
      v_state := jsonb_set(v_state,'{coins}',to_jsonb(v_coins - 10));
      v_applied := true;
    end if;

  elsif p_action = 'register_analysis' then
    v_analysis := p_payload->'analysis';
    if length(coalesce(v_article_id,'')) not between 1 and 300
      or not exists (select 1 from jsonb_array_elements(v_state->'newsHistory') as item
        where item->>'articleId' = v_article_id)
      or jsonb_typeof(v_analysis) <> 'object'
      or jsonb_typeof(v_analysis->'summary') <> 'array'
      or jsonb_array_length(v_analysis->'summary') <> 3
      or v_analysis->>'issueId' not in ('AI_TECH','SEMICONDUCTOR','ECONOMY','GLOBAL','SOCIETY','CULTURE','SPORTS')
      or v_analysis->'marketImpact'->>'relatedIssue' <> v_analysis->>'issueId'
      or v_analysis->'marketImpact'->>'direction' not in ('UP','NEUTRAL','DOWN')
      or jsonb_typeof(v_analysis->'quiz'->'choices') <> 'array'
      or jsonb_array_length(v_analysis->'quiz'->'choices') <> 4 then
      v_message := '분석 결과를 확인할 수 없습니다.';
    else
      v_event := v_state->'hackEvents'->v_article_id;
      if v_event is null and (p_payload->>'available')::boolean = true
        and (v_analysis->>'insufficient')::boolean = false then
        v_streak := (v_state->>'hackNormalStreak')::integer;
        if v_streak >= 4 or random() < 0.2 then
          v_event := jsonb_build_object('active',true,'resolved',false,'pendingAnalysis',v_analysis);
          v_state := jsonb_set(v_state,'{hackNormalStreak}','0'::jsonb);
        else
          v_event := '{"active":false,"resolved":true}'::jsonb;
          v_state := jsonb_set(v_state,'{hackNormalStreak}',to_jsonb(v_streak + 1));
        end if;
        v_state := jsonb_set(v_state,array['hackEvents',v_article_id],v_event);
      end if;
      if v_event is null or coalesce((v_event->>'resolved')::boolean,false) then
        v_state := public.newspi_history_patch(v_state,v_article_id,
          jsonb_build_object('summary',v_analysis->'summary','importance',v_analysis->>'whyItMatters',
            'hackEvent',coalesce((v_event->>'active')::boolean,false)));
      else
        v_state := public.newspi_history_patch(v_state,v_article_id,'{"hackEvent":true}'::jsonb);
      end if;
      v_id := 'market-impact-v2:' || v_article_id;
      v_list := coalesce(v_state->'analysisCacheOrder','[]'::jsonb);
      if not (v_list ? v_id) then
        v_list := v_list || to_jsonb(v_id);
        if jsonb_array_length(v_list) > 60 then
          v_state := jsonb_set(v_state,'{cachedAnalyses}',(v_state->'cachedAnalyses') - (v_list->>0));
          select jsonb_agg(item order by ord) into v_list
          from jsonb_array_elements(v_list) with ordinality as t(item,ord) where ord > 1;
        end if;
        v_state := jsonb_set(v_state,'{analysisCacheOrder}',v_list);
      end if;
      v_state := jsonb_set(v_state,array['cachedAnalyses',v_id],v_analysis);
      v_applied := true;
    end if;

  elsif p_action in ('wrong_quiz','award_quiz') then
    v_analysis := v_state->'cachedAnalyses'->('market-impact-v2:' || v_article_id);
    v_attempts := coalesce((v_state->'quizAttempts'->>v_article_id)::integer,0);
    if v_analysis is null or coalesce((v_analysis->>'insufficient')::boolean,true)
      or v_state->'completedQuizIds' ? v_article_id or v_attempts >= 2
      or jsonb_typeof(p_payload->'selectedIndex') <> 'number'
      or (p_payload->>'selectedIndex')::integer not between 0 and 3 then
      v_message := '이 퀴즈의 보상을 받을 수 없습니다.';
    elsif p_action = 'wrong_quiz' and (p_payload->>'selectedIndex')::integer <> (v_analysis->'quiz'->>'answerIndex')::integer then
      v_attempts := v_attempts + 1;
      v_state := jsonb_set(v_state,array['quizAttempts',v_article_id],to_jsonb(v_attempts));
      v_state := v_state || '{"quizCurrentStreak":0}'::jsonb;
      v_state := jsonb_set(v_state,'{dailyMission,quizStreak}','0'::jsonb);
      v_state := public.newspi_history_patch(v_state,v_article_id,
        jsonb_build_object('quizAnswered',true,'quizCorrect',false,'quizAttempts',v_attempts));
      v_applied := true;
    elsif p_action = 'award_quiz' and (p_payload->>'selectedIndex')::integer = (v_analysis->'quiz'->>'answerIndex')::integer then
      v_reward := case when v_attempts = 0 then 25 else 10 end;
      v_state := jsonb_set(v_state,'{coins}',to_jsonb(v_coins + v_reward));
      v_state := jsonb_set(v_state,'{completedQuizIds}',v_state->'completedQuizIds' || to_jsonb(v_article_id));
      v_state := jsonb_set(v_state,'{quizCurrentStreak}',to_jsonb((v_state->>'quizCurrentStreak')::integer + 1));
      v_state := jsonb_set(v_state,'{totalNewsCoinsEarned}',to_jsonb((v_state->>'totalNewsCoinsEarned')::numeric + v_reward));
      v_state := jsonb_set(v_state,'{dailyMission,quizStreak}',
        to_jsonb(least(2,(v_daily->>'quizStreak')::integer + 1)));
      v_state := public.newspi_history_patch(v_state,v_article_id,
        jsonb_build_object('quizAnswered',true,'quizCorrect',true,'quizAttempts',v_attempts + 1,'quizReward',v_reward));
      v_applied := true;
    else
      v_message := '선택한 답을 다시 확인해 주세요.';
    end if;

  elsif p_action = 'happy' then
    select phrase into v_phrase from public.happy_phrases
      where phrase_index = ((v_state->>'happyTypingCount')::integer % 6);
    if v_coins >= 10 then v_message := '행복한 뒤주는 파산 위기에 처한 백성에게만 열립니다.';
    elsif (v_state->>'happyDailyEarned')::integer >= 10 then v_message := '오늘의 뒤주 보상 10 C를 모두 받았습니다.';
    elsif regexp_replace(trim(coalesce(p_payload->>'text','')),'\s+',' ','g') <> regexp_replace(trim(v_phrase),'\s+',' ','g') then
      v_message := '문장을 다시 확인해 주세요.';
    else
      v_state := v_state || jsonb_build_object('coins',v_coins + 1,
        'happyTypingCount',(v_state->>'happyTypingCount')::integer + 1,
        'happyDailyEarned',(v_state->>'happyDailyEarned')::integer + 1);
      v_applied := true;
    end if;

  elsif p_action = 'refund_roulette' then
    begin v_spin_id := (p_payload->>'spinId')::uuid; exception when others then v_spin_id := null; end;
    if v_spin_id is not null then
      update public.roulette_spins set refunded = true
      where user_id = v_user and spin_id = v_spin_id and refunded = false
      returning refunded into v_refunded;
      if v_refunded then
        v_state := jsonb_set(v_state,'{coins}',to_jsonb(v_coins + 10));
        v_applied := true;
      end if;
    end if;

  elsif p_action = 'record_view' then
    v_record := p_payload->'article';
    if length(coalesce(v_record->>'id','')) not between 1 and 300
      or length(coalesce(v_record->>'title','')) not between 1 and 300
      or length(coalesce(v_record->>'sourceUrl','')) not between 1 and 1000
      or coalesce(v_record->>'sourceUrl','') !~* '^https?://'
      or (v_record->>'category') not in ('domestic','world','economy','technology','society','culture','sports')
      or jsonb_typeof(v_record->'isFallback') <> 'boolean' then
      v_message := '기사 정보를 확인할 수 없습니다.';
    else
      v_article_id := v_record->>'id';
      select item into v_history from jsonb_array_elements(v_state->'newsHistory') as item
        where item->>'articleId' = v_article_id limit 1;
      v_event := v_state->'hackEvents'->v_article_id;
      v_history := jsonb_build_object(
        'articleId',v_article_id,'title',v_record->>'title','category',v_record->>'category',
        'source',coalesce(nullif(v_record->>'source',''),'출처 확인'),
        'publishedAt',coalesce(v_record->>'publishedAt',''), 'viewedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'originalLink',v_record->>'sourceUrl','summary',coalesce(v_history->'summary','[]'::jsonb),
        'importance',coalesce(v_history->>'importance',''),
        'isLive',not (v_record->>'isFallback')::boolean,
        'quizAnswered',coalesce((v_history->>'quizAnswered')::boolean,
          (v_state->'completedQuizIds' ? v_article_id) or coalesce((v_state->'quizAttempts'->>v_article_id)::integer,0) > 0,false),
        'quizCorrect',coalesce((v_history->>'quizCorrect')::boolean,v_state->'completedQuizIds' ? v_article_id,false),
        'quizAttempts',coalesce((v_history->>'quizAttempts')::integer,(v_state->'quizAttempts'->>v_article_id)::integer,0),
        'quizReward',coalesce((v_history->>'quizReward')::integer,0),
        'hackEvent',coalesce((v_history->>'hackEvent')::boolean,(v_event->>'active')::boolean,false));
      if v_event ? 'prediction' then v_history := v_history || jsonb_build_object('prediction',v_event->'prediction'); end if;
      select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) into v_list
      from jsonb_array_elements(v_state->'newsHistory') with ordinality as t(item,ord)
      where item->>'articleId' <> v_article_id;
      select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) into v_list
      from jsonb_array_elements(v_list || jsonb_build_array(v_history)) with ordinality as t(item,ord)
      where ord > greatest(0,jsonb_array_length(v_list || jsonb_build_array(v_history))-100);
      v_state := jsonb_set(v_state,'{newsHistory}',v_list);
      if not (v_state->'seenNewsIds' ? v_article_id) then
        select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) into v_seen
        from jsonb_array_elements((v_state->'seenNewsIds') || to_jsonb(v_article_id)) with ordinality as t(item,ord)
        where ord > greatest(0,jsonb_array_length((v_state->'seenNewsIds') || to_jsonb(v_article_id))-100);
        v_state := jsonb_set(v_state,'{seenNewsIds}',v_seen);
      end if;
      v_read_ids := v_daily->'readArticleIds';
      if not (v_read_ids ? v_article_id) and jsonb_array_length(v_read_ids) < 3 then
        v_state := jsonb_set(v_state,'{dailyMission,readArticleIds}',v_read_ids || to_jsonb(v_article_id));
      end if;
      v_applied := true;
    end if;

  elsif p_action in ('buy','sell') then
    if v_id not in ('AI_TECH','SEMICONDUCTOR','ECONOMY','GLOBAL','SOCIETY','CULTURE','SPORTS')
      or jsonb_typeof(p_payload->'quantity') <> 'number'
      or (p_payload->>'quantity')::numeric <> trunc((p_payload->>'quantity')::numeric)
      or (p_payload->>'quantity')::numeric not between 1 and 1000000 then
      v_message := '거래 수량과 이슈를 확인해 주세요.';
    else
      v_amount := (p_payload->>'quantity')::integer;
      v_price := (v_state->'market'->v_id->>'currentPrice')::numeric;
      v_holding := v_state->'holdings'->v_id;
      v_quantity := (v_holding->>'quantity')::integer;
      v_cost := round(v_price * v_amount,2);
      if p_action = 'buy' and v_cost > v_coins then v_message := '보유 코인이 부족합니다.';
      elsif p_action = 'sell' and v_amount > v_quantity then v_message := '보유 수량이 부족합니다.';
      elsif p_action = 'buy' then
        v_state := jsonb_set(v_state,'{coins}',to_jsonb(v_coins - v_cost));
        v_state := jsonb_set(v_state,array['holdings',v_id],jsonb_build_object(
          'quantity',v_quantity + v_amount,
          'averagePrice',((v_quantity * (v_holding->>'averagePrice')::numeric) + v_cost) / (v_quantity + v_amount)));
        v_applied := true;
      else
        v_state := jsonb_set(v_state,'{coins}',to_jsonb(v_coins + v_cost));
        v_state := jsonb_set(v_state,array['holdings',v_id],jsonb_build_object(
          'quantity',v_quantity - v_amount,
          'averagePrice',case when v_quantity = v_amount then 0 else (v_holding->>'averagePrice')::numeric end));
        v_applied := true;
      end if;
      if v_applied then
        insert into public.trades (user_id,asset_id,trade_type,quantity,price,total_amount)
        values (v_user,v_id,upper(p_action),v_amount,v_price,v_cost);
        v_message := case when p_action = 'buy' then v_amount || '주를 매수했습니다.' else v_amount || '주를 매도했습니다.' end;
      end if;
    end if;

  elsif p_action = 'tick' then
    if v_now_ms >= (v_state->>'nextMarketTickAt')::bigint then
      v_due := least(60, floor((v_now_ms - (v_state->>'nextMarketTickAt')::bigint) / 60000)::integer + 1);
      for v_index in 1..v_due loop
        for v_asset in select id from public.market_assets order by sort_order loop
          v_rate := (random() - 0.5) * 0.01;
          v_state := jsonb_set(v_state,array['market',v_asset.id],
            public.newspi_move_price(v_state->'market'->v_asset.id,v_rate));
        end loop;
      end loop;
      v_state := jsonb_set(v_state,'{marketTickCount}',
        to_jsonb((v_state->>'marketTickCount')::integer + v_due));
      v_next_tick := (v_state->>'nextMarketTickAt')::bigint + v_due * 60000;
      v_state := jsonb_set(v_state,'{nextMarketTickAt}',
        to_jsonb(case when v_next_tick > v_now_ms then v_next_tick else v_now_ms + 60000 end));
      v_applied := true;
    end if;

  elsif p_action = 'apply_impact' then
    v_analysis := v_state->'cachedAnalyses'->('market-impact-v2:' || v_article_id);
    v_event := v_state->'hackEvents'->v_article_id;
    if length(coalesce(v_article_id,'')) not between 1 and 300 or v_analysis is null then
      v_message := '분석 결과를 확인할 수 없습니다.';
    elsif coalesce((v_event->>'active')::boolean,false) and not coalesce((v_event->>'resolved')::boolean,false) then
      v_message := '예측을 먼저 완료해 주세요.';
    elsif not (v_state->'processedImpactIds' ? v_article_id) then
      v_state := public.newspi_apply_impact(v_state,v_article_id,v_analysis->'marketImpact');
      v_applied := true;
    end if;

  elsif p_action = 'resolve_hack' then
    v_event := v_state->'hackEvents'->v_article_id;
    v_analysis := v_event->'pendingAnalysis';
    v_impact := v_analysis->'marketImpact';
    if length(coalesce(v_article_id,'')) not between 1 and 300 or v_event is null
      or not coalesce((v_event->>'active')::boolean,false)
      or coalesce((v_event->>'resolved')::boolean,false) or v_impact is null then
      v_message := '이미 복구했거나 예측할 수 없는 분석입니다.';
    elsif jsonb_typeof(p_payload->'betAmount') <> 'number' then
      v_message := '베팅 금액을 확인해 주세요.';
    else
      v_amount := (p_payload->>'betAmount')::integer;
      if v_amount = 0 and v_coins >= 10 then v_message := '베팅 없이 복구할 수 있는 잔액인지 확인해 주세요.';
      elsif v_amount not in (0,10,20,30) or v_amount > v_coins then v_message := '베팅 금액과 보유 코인을 확인해 주세요.';
      elsif v_amount > 0 and ((p_payload->>'selectedIssue') not in
        ('AI_TECH','SEMICONDUCTOR','ECONOMY','GLOBAL','SOCIETY','CULTURE','SPORTS')
        or (p_payload->>'selectedDirection') not in ('UP','NEUTRAL','DOWN')) then
        v_message := '이슈와 방향을 선택해 주세요.';
      else
        v_prediction := null;
        v_payout := 0;
        if v_amount > 0 then
          if p_payload->>'selectedDirection' <> v_impact->>'direction' then v_result := 'MISS';
          elsif p_payload->>'selectedIssue' = v_impact->>'relatedIssue' then v_result := 'EXACT';
          else v_result := 'DIRECTION_ONLY'; end if;
          v_payout := case v_result when 'EXACT' then v_amount * 2 when 'DIRECTION_ONLY' then v_amount else 0 end;
          v_prediction := jsonb_build_object('selectedIssue',p_payload->>'selectedIssue',
            'selectedDirection',p_payload->>'selectedDirection','betAmount',v_amount,
            'result',v_result,'profit',v_payout - v_amount);
        end if;
        v_state := jsonb_set(v_state,'{coins}',to_jsonb(v_coins - v_amount + v_payout));
        v_state := jsonb_set(v_state,'{totalNewsCoinsEarned}',
          to_jsonb((v_state->>'totalNewsCoinsEarned')::numeric + v_payout - v_amount));
        v_state := public.newspi_apply_impact(v_state,v_article_id,v_impact);
        v_event := jsonb_build_object('active',true,'resolved',true);
        if v_prediction is not null then
          v_event := v_event || jsonb_build_object('prediction',v_prediction);
          v_read_ids := v_daily->'predictedArticleIds';
          if not (v_read_ids ? v_article_id) and jsonb_array_length(v_read_ids) < 1 then
            v_state := jsonb_set(v_state,'{dailyMission,predictedArticleIds}',v_read_ids || to_jsonb(v_article_id));
          end if;
        end if;
        v_state := jsonb_set(v_state,array['hackEvents',v_article_id],v_event);
        v_record := jsonb_build_object('hackEvent',true,'summary',v_analysis->'summary',
          'importance',v_analysis->>'whyItMatters');
        if v_prediction is not null then v_record := v_record || jsonb_build_object('prediction',v_prediction); end if;
        v_state := public.newspi_history_patch(v_state,v_article_id,v_record);
        v_applied := true;
      end if;
    end if;

  elsif p_action = 'claim_mission' then
    v_id := p_payload->>'missionId';
    if v_id is null or v_id not in ('explorer','streak','hacker') then v_message := '미션을 확인할 수 없습니다.';
    elsif (v_daily->'claimed'->>v_id)::boolean then v_message := '이미 받은 미션 보상입니다.';
    else
      v_target := case v_id when 'explorer' then 3 when 'streak' then 2 else 1 end;
      v_amount := case v_id when 'explorer' then jsonb_array_length(v_daily->'readArticleIds')
        when 'streak' then (v_daily->>'quizStreak')::integer
        else jsonb_array_length(v_daily->'predictedArticleIds') end;
      if v_amount < v_target then v_message := '미션 진행도를 먼저 채워 주세요.';
      else
        v_state := jsonb_set(v_state,'{coins}',to_jsonb(v_coins + 20));
        v_state := jsonb_set(v_state,array['dailyMission','claimed',v_id],'true'::jsonb);
        v_applied := true;
      end if;
    end if;

  elsif p_action = 'claim_all' then
    if (v_daily->>'allClaimed')::boolean then v_message := '이미 받은 전체 보상입니다.';
    elsif not ((v_daily->'claimed'->>'explorer')::boolean
      and (v_daily->'claimed'->>'streak')::boolean
      and (v_daily->'claimed'->>'hacker')::boolean) then
      v_message := '세 미션의 보상을 먼저 받아 주세요.';
    else
      v_state := jsonb_set(v_state,'{coins}',to_jsonb(v_coins + 20));
      v_state := jsonb_set(v_state,'{dailyMission,allClaimed}','true'::jsonb);
      v_applied := true;
    end if;

  else
    v_message := '지원하지 않는 게임 요청입니다.';
  end if;

  if v_applied then
    perform public.newspi_sync_state(v_user, v_state);
    update public.profiles set has_game_activity = true where id = v_user;
  end if;
  return jsonb_build_object('ok', v_applied or v_message = '', 'message',v_message,'applied',v_applied,
    'state',v_state,'migrationCompleted',true);
end;
$$;

revoke all on function public.newspi_date_key() from public, anon, authenticated;
revoke all on function public.newspi_initial_state() from public, anon, authenticated;
revoke all on function public.newspi_valid_import(jsonb) from public, anon, authenticated;
revoke all on function public.newspi_sync_state(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.newspi_move_price(jsonb,numeric) from public, anon, authenticated;
revoke all on function public.newspi_apply_impact(jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function public.newspi_history_patch(jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function public.newspi_game_action(text,jsonb) from public, anon;
grant execute on function public.newspi_game_action(text,jsonb) to authenticated;
