import { ISSUE_DEFINITIONS } from "@/data/market-issues";
import type { IssueId, MarketIssue, MarketPrice, UserState } from "@/types";

export const MAX_DEMO_DAY = 365;
export const MARKET_TICK_MS = 60_000;
export const NEWS_IMPACT_RATE = 0.03;
const MAX_CATCH_UP_TICKS = 60;
const MAX_PRICE_HISTORY = 60;

export function initialMarketPrices(day = 0): Record<IssueId, MarketPrice> {
  const safeDay = Math.max(0, Math.min(MAX_DEMO_DAY, Math.floor(day)));
  return Object.fromEntries(ISSUE_DEFINITIONS.map((issue) => {
    const priceHistory = [0.92, 0.96, 0.95, 1.01, 0.98, 1].map((ratio) => Math.max(10, Math.round(issue.basePrice * ratio)));
    for (let index = 0; index < safeDay; index += 1) {
      const change = issue.dailyChanges[index % issue.dailyChanges.length];
      priceHistory.push(Math.max(10, Math.round(priceHistory[priceHistory.length - 1] * (1 + change))));
    }
    return [issue.id, {
      currentPrice: priceHistory[priceHistory.length - 1],
      previousPrice: safeDay ? priceHistory[priceHistory.length - 2] : issue.basePrice,
      priceHistory: priceHistory.slice(-MAX_PRICE_HISTORY),
    }];
  })) as Record<IssueId, MarketPrice>;
}

export function getMarketIssues(state: UserState): MarketIssue[] {
  return ISSUE_DEFINITIONS.map((issue) => ({
    id: issue.id,
    name: issue.name,
    ...state.market[issue.id],
  }));
}

function movePrice(price: MarketPrice, direction: 1 | -1, rate: number): MarketPrice {
  const step = Math.max(1, Math.round(price.currentPrice * rate));
  const candidate = price.currentPrice + direction * step;
  const currentPrice = Math.max(10, candidate);
  return {
    previousPrice: price.currentPrice,
    currentPrice,
    priceHistory: [...price.priceHistory, currentPrice].slice(-MAX_PRICE_HISTORY),
  };
}

export function advanceMarketTicks(state: UserState, now: number, random = Math.random): UserState {
  if (now < state.nextMarketTickAt) return state;
  const due = Math.min(MAX_CATCH_UP_TICKS, Math.floor((now - state.nextMarketTickAt) / MARKET_TICK_MS) + 1);
  let market = state.market;
  for (let tick = 0; tick < due; tick += 1) {
    market = Object.fromEntries(ISSUE_DEFINITIONS.map((issue) => {
      const sample = random();
      const direction: 1 | -1 = sample < 0.5 ? -1 : 1;
      const rate = 0.005 + Math.abs(sample - 0.5) * 0.02;
      return [issue.id, movePrice(market[issue.id], direction, rate)];
    })) as Record<IssueId, MarketPrice>;
  }
  const nextTickAt = state.nextMarketTickAt + due * MARKET_TICK_MS;
  return {
    ...state,
    market,
    marketTickCount: state.marketTickCount + due,
    nextMarketTickAt: nextTickAt > now ? nextTickAt : now + MARKET_TICK_MS,
  };
}

export function applyIssueImpact(market: UserState["market"], id: IssueId, direction: "positive" | "negative" | "neutral"): UserState["market"] {
  if (direction === "neutral") return market;
  return {
    ...market,
    [id]: movePrice(market[id], direction === "positive" ? 1 : -1, NEWS_IMPACT_RATE),
  };
}

export function changePercent(issue: MarketIssue): number {
  return issue.previousPrice === 0 ? 0 : ((issue.currentPrice - issue.previousPrice) / issue.previousPrice) * 100;
}

export function portfolioTotals(state: UserState, market: MarketIssue[]) {
  const holdingsValue = market.reduce((sum, issue) => sum + state.holdings[issue.id].quantity * issue.currentPrice, 0);
  const investedCost = market.reduce((sum, issue) => sum + state.holdings[issue.id].quantity * state.holdings[issue.id].averagePrice, 0);
  const unrealized = holdingsValue - investedCost;
  return {
    holdingsValue,
    investedCost,
    unrealized,
    totalAssets: state.coins + holdingsValue,
    returnPercent: investedCost > 0 ? (unrealized / investedCost) * 100 : 0,
  };
}

export function issueForCategory(category: string): IssueId {
  const map: Record<string, IssueId> = {
    domestic: "SOCIETY", world: "GLOBAL", economy: "ECONOMY", technology: "AI_TECH",
    society: "SOCIETY", culture: "CULTURE", sports: "SPORTS",
  };
  return map[category] ?? "SOCIETY";
}
