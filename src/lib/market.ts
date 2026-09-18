import { ISSUE_DEFINITIONS } from "@/data/market-issues";
import type { IssueId, MarketIssue, UserState } from "@/types";

export const MAX_DEMO_DAY = 365;

export function getMarketIssues(day: number): MarketIssue[] {
  const safeDay = Math.max(0, Math.min(MAX_DEMO_DAY, Math.floor(day)));
  return ISSUE_DEFINITIONS.map((issue) => {
    const priceHistory = [0.92, 0.96, 0.95, 1.01, 0.98, 1].map((ratio) => Math.max(10, Math.round(issue.basePrice * ratio)));
    for (let index = 0; index < safeDay; index += 1) {
      const change = issue.dailyChanges[index % issue.dailyChanges.length];
      priceHistory.push(Math.max(10, Math.round(priceHistory[priceHistory.length - 1] * (1 + change))));
    }
    return {
      id: issue.id,
      name: issue.name,
      currentPrice: priceHistory[priceHistory.length - 1],
      previousPrice: safeDay ? priceHistory[priceHistory.length - 2] : issue.basePrice,
      priceHistory,
      dailyChanges: issue.dailyChanges,
    };
  });
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
