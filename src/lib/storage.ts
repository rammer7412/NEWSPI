import { ISSUE_IDS, type AnalyzedNews, type Holding, type IssueId, type MarketPrice, type UserState } from "@/types";
import { initialMarketPrices, MARKET_TICK_MS, MAX_DEMO_DAY } from "@/lib/market";

const STORAGE_KEY = "newspi:user:v1";

const emptyHoldings = (): Record<IssueId, Holding> => Object.fromEntries(
  ISSUE_IDS.map((id) => [id, { quantity: 0, averagePrice: 0 }]),
) as Record<IssueId, Holding>;

export function initialUserState(): UserState {
  return {
    coins: 100,
    happyTypingCount: 0,
    holdings: emptyHoldings(),
    completedQuizIds: [],
    quizAttempts: {},
    seenNewsIds: [],
    cachedAnalyses: {},
    currentDay: 0,
    market: initialMarketPrices(),
    nextMarketTickAt: Date.now() + MARKET_TICK_MS,
    marketTickCount: 0,
    processedImpactIds: [],
  };
}

function safeNonNegative(value: unknown, fallback: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return integer ? Math.floor(value) : value;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length <= 300))] : [];
}

function validAnalysis(value: unknown): value is AnalyzedNews {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AnalyzedNews>;
  return Array.isArray(item.summary) && item.summary.length === 3 && item.summary.every((part) => typeof part === "string") &&
    typeof item.whyItMatters === "string" && ISSUE_IDS.includes(item.issueId as IssueId) &&
    !!item.marketImpact && ["positive", "negative", "neutral"].includes(item.marketImpact.direction) &&
    typeof item.marketImpact.reason === "string" &&
    typeof item.insufficient === "boolean" && !!item.quiz && typeof item.quiz.question === "string" &&
    Array.isArray(item.quiz.choices) && item.quiz.choices.length === 4 &&
    item.quiz.choices.every((choice) => typeof choice === "string") &&
    Number.isInteger(item.quiz.answerIndex) && item.quiz.answerIndex >= 0 && item.quiz.answerIndex <= 3 &&
    typeof item.quiz.explanation === "string";
}

export function normalizeUserState(value: unknown): UserState {
  const base = initialUserState();
  if (!value || typeof value !== "object") return base;
  const data = value as Record<string, unknown>;
  const rawHoldings = data.holdings && typeof data.holdings === "object" ? data.holdings as Record<string, unknown> : {};
  for (const id of ISSUE_IDS) {
    const raw = rawHoldings[id];
    if (!raw || typeof raw !== "object") continue;
    const holding = raw as Record<string, unknown>;
    const quantity = safeNonNegative(holding.quantity, 0, true);
    base.holdings[id] = {
      quantity,
      averagePrice: quantity ? safeNonNegative(holding.averagePrice, 0) : 0,
    };
  }
  const rawAnalyses = data.cachedAnalyses && typeof data.cachedAnalyses === "object" ? data.cachedAnalyses as Record<string, unknown> : {};
  const cachedAnalyses: Record<string, AnalyzedNews> = {};
  for (const [key, analysis] of Object.entries(rawAnalyses).slice(-60)) {
    if (key.length <= 300 && validAnalysis(analysis)) cachedAnalyses[key] = analysis;
  }
  const rawAttempts = data.quizAttempts && typeof data.quizAttempts === "object" ? data.quizAttempts as Record<string, unknown> : {};
  const quizAttempts: Record<string, number> = {};
  for (const [key, count] of Object.entries(rawAttempts)) {
    if (key.length <= 300 && typeof count === "number" && Number.isFinite(count)) quizAttempts[key] = Math.min(2, Math.max(0, Math.floor(count)));
  }
  const completedQuizIds = stringList(data.completedQuizIds);
  const legacyFreshBalance = !("happyTypingCount" in data) && data.coins === 1000 &&
    completedQuizIds.length === 0 &&
    safeNonNegative(data.currentDay, 0, true) === 0 &&
    ISSUE_IDS.every((id) => base.holdings[id].quantity === 0);
  const currentDay = Math.min(MAX_DEMO_DAY, safeNonNegative(data.currentDay, 0, true));
  const legacyMarket = initialMarketPrices(currentDay);
  const rawMarket = data.market && typeof data.market === "object" ? data.market as Record<string, unknown> : {};
  const market = {} as Record<IssueId, MarketPrice>;
  for (const id of ISSUE_IDS) {
    const raw = rawMarket[id];
    if (!raw || typeof raw !== "object") { market[id] = legacyMarket[id]; continue; }
    const price = raw as Record<string, unknown>;
    if (!Number.isInteger(price.currentPrice) || (price.currentPrice as number) < 10 ||
        !Number.isInteger(price.previousPrice) || (price.previousPrice as number) < 10 ||
        !Array.isArray(price.priceHistory) || !price.priceHistory.length ||
        !price.priceHistory.every((item) => Number.isInteger(item) && item >= 10) ||
        price.priceHistory[price.priceHistory.length - 1] !== price.currentPrice) {
      market[id] = legacyMarket[id];
      continue;
    }
    market[id] = {
      currentPrice: price.currentPrice as number,
      previousPrice: price.previousPrice as number,
      priceHistory: price.priceHistory.slice(-60),
    };
  }
  const savedTickAt = data.nextMarketTickAt;
  const now = Date.now();
  return {
    coins: legacyFreshBalance ? 100 : safeNonNegative(data.coins, 100, true),
    happyTypingCount: safeNonNegative(data.happyTypingCount, 0, true),
    holdings: base.holdings,
    completedQuizIds,
    quizAttempts,
    seenNewsIds: stringList(data.seenNewsIds).slice(-100),
    cachedAnalyses,
    currentDay,
    market,
    nextMarketTickAt: typeof savedTickAt === "number" && Number.isFinite(savedTickAt) &&
      savedTickAt > 0 && savedTickAt <= now + MARKET_TICK_MS ? savedTickAt : now + MARKET_TICK_MS,
    marketTickCount: safeNonNegative(data.marketTickCount, 0, true),
    processedImpactIds: stringList(data.processedImpactIds),
  };
}

export function loadUserState(): UserState {
  if (typeof window === "undefined") return initialUserState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("newspi:user");
    return raw ? normalizeUserState(JSON.parse(raw)) : initialUserState();
  } catch {
    return initialUserState();
  }
}

export function saveUserState(state: UserState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or a full storage quota must not interrupt the game.
  }
}
