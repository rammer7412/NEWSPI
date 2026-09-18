import { ISSUE_IDS, MISSION_IDS, type IssueId, type UserState } from "@/types";
import { normalizeUserState } from "@/lib/storage";

export const LEGACY_GAME_KEYS = ["newspi:user:v1", "newspi:user"] as const;

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeNumber(value: unknown, minimum: number, maximum: number, integer = false): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum &&
    (!integer || Number.isInteger(value));
}

export function validateLegacyState(raw: unknown): UserState {
  const state = object(raw);
  if (!state || !safeNumber(state.coins, 0, 1_000_000_000) || !object(state.holdings)) {
    throw new Error("기존 게임 데이터가 손상됐습니다. 브라우저 데이터는 그대로 보관됩니다.");
  }
  const holdings = state.holdings as Record<string, unknown>;
  for (const id of ISSUE_IDS) {
    const holding = object(holdings[id]);
    if (holding && (!safeNumber(holding.quantity, 0, 1_000_000, true) ||
      !safeNumber(holding.averagePrice, 0, 1_000_000_000))) throw new Error("기존 보유 자산 값을 확인할 수 없습니다.");
  }
  const market = object(state.market);
  if (market) for (const id of ISSUE_IDS) {
    const issue = object(market[id]);
    if (!issue) continue;
    if (!safeNumber(issue.currentPrice, 0.01, 1_000_000_000) ||
      !safeNumber(issue.previousPrice, 0.01, 1_000_000_000) ||
      !Array.isArray(issue.priceHistory) || issue.priceHistory.length > 60 ||
      issue.priceHistory.some((value) => !safeNumber(value, 0.01, 1_000_000_000))) {
      throw new Error("기존 가격 기록을 확인할 수 없습니다.");
    }
  }
  if (Array.isArray(state.newsHistory)) {
    if (state.newsHistory.length > 100) throw new Error("기존 뉴스 기록이 허용 크기를 넘었습니다.");
    for (const entry of state.newsHistory) {
      const item = object(entry);
      if (!item || typeof item.articleId !== "string" || item.articleId.length > 300 ||
        typeof item.originalLink !== "string" || item.originalLink.length > 1000 ||
        !/^https?:\/\//i.test(item.originalLink)) throw new Error("기존 뉴스 기록을 확인할 수 없습니다.");
      if (item.prediction) {
        const prediction = object(item.prediction);
        if (!prediction || !ISSUE_IDS.includes(prediction.selectedIssue as IssueId) ||
          !["UP", "NEUTRAL", "DOWN"].includes(prediction.selectedDirection as string) ||
          !["EXACT", "DIRECTION_ONLY", "MISS"].includes(prediction.result as string) ||
          ![10, 20, 30].includes(prediction.betAmount as number)) {
          throw new Error("기존 예측 기록을 확인할 수 없습니다.");
        }
      }
    }
  }
  const daily = object(state.dailyMission);
  if (daily) {
    const claimed = object(daily.claimed);
    if (!claimed || MISSION_IDS.some((id) => typeof claimed[id] !== "boolean") ||
      typeof daily.allClaimed !== "boolean") throw new Error("기존 미션 기록을 확인할 수 없습니다.");
  }
  const normalized = normalizeUserState(raw, false);
  // The normalizer bounds and deduplicates older versions before server import.
  if (normalized.newsHistory.length > 100) throw new Error("기존 뉴스 기록이 허용 크기를 넘었습니다.");
  return normalized;
}

export function readLegacyState(): UserState | null {
  for (const key of LEGACY_GAME_KEYS) {
    const value = localStorage.getItem(key);
    if (value === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { throw new Error("기존 게임 데이터 JSON을 읽을 수 없습니다. 브라우저 데이터는 그대로 보관됩니다."); }
    return validateLegacyState(parsed);
  }
  return null;
}

export function clearLegacyState(): void {
  for (const key of LEGACY_GAME_KEYS) localStorage.removeItem(key);
}
