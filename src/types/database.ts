import type { IssueId, UserState } from "@/types";

// PostgreSQL column names remain snake_case; game_state uses the existing UI
// domain shape. The other tables are transactional projections of that value.
export type ProfileRow = {
  id: string;
  coins: number;
  total_earned: number;
  current_quiz_streak: number;
  game_state: UserState;
  revision: number;
  has_game_activity: boolean;
  local_migration_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketAssetRow = { id: IssueId; name: string; base_price: number; sort_order: number; created_at: string };
export type UserMarketStateRow = {
  user_id: string; asset_id: IssueId; current_price: number; previous_price: number;
  price_history: number[]; last_tick_at: string; updated_at: string;
};
export type PositionRow = { user_id: string; asset_id: IssueId; quantity: number; average_buy_price: number; updated_at: string };
export type TradeRow = {
  id: string; user_id: string; asset_id: IssueId; trade_type: "BUY" | "SELL";
  quantity: number; price: number; total_amount: number; created_at: string;
};
export type NewsHistoryRow = {
  id: string; user_id: string; article_id: string; title: string; category: string | null;
  source: string | null; published_at: string | null; viewed_at: string; original_link: string | null;
  summary: string[]; importance: string; is_live: boolean; quiz_answered: boolean;
  quiz_correct: boolean; quiz_attempts: number; quiz_reward: number; hack_event: boolean;
  prediction: Record<string, unknown> | null; created_at: string; updated_at: string;
};
export type ArticleProgressRow = {
  user_id: string; article_id: string; quiz_reward_claimed: boolean; quiz_attempts: number;
  hack_event_decided: boolean; hack_event_settled: boolean; market_impact_applied: boolean;
  mission_news_read: boolean; mission_hack_predicted: boolean; hack_state: Record<string, unknown> | null;
  created_at: string; updated_at: string;
};
export type DailyMissionRow = {
  user_id: string; mission_date: string; read_article_ids: string[]; quiz_streak_count: number;
  predicted_article_ids: string[]; news_mission_claimed: boolean; quiz_mission_claimed: boolean;
  hack_mission_claimed: boolean; all_complete_bonus_claimed: boolean; updated_at: string;
};
export type DailyReliefRow = { user_id: string; relief_date: string; earned_coins: number; updated_at: string };
export type LongShortBetRow = {
  id: string; user_id: string; asset_id: IssueId; direction: "LONG" | "SHORT"; stake: number;
  entry_price: number; exit_price: number | null; payout: number | null;
  status: "OPEN" | "WON" | "LOST" | "DRAW"; opened_at: string; expires_at: string;
  settled_at: string | null; created_at: string;
};
