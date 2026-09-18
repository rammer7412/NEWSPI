import { ISSUE_IDS, MISSION_IDS, NEWS_CATEGORIES, type AnalyzedNews, type DailyMissionState, type HackEventState, type Holding, type IssueId, type MarketPrice, type NewsActivity, type Prediction, type UserState } from "@/types";
import { clampMagnitude, initialMarketPrices, MARKET_TICK_MS, MAX_DEMO_DAY } from "@/lib/market";
import { INITIAL_COINS, initialDailyMission, localDateKey, rolloverDailyState } from "@/lib/game";

const STORAGE_KEY = "newspi:user:v1";

const emptyHoldings = (): Record<IssueId, Holding> => Object.fromEntries(
  ISSUE_IDS.map((id) => [id, { quantity: 0, averagePrice: 0 }]),
) as Record<IssueId, Holding>;

export function initialUserState(): UserState {
  return {
    version: 2,
    coins: INITIAL_COINS,
    happyTypingCount: 0,
    happyDailyDate: localDateKey(),
    happyDailyEarned: 0,
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
    newsHistory: [],
    hackEvents: {},
    hackNormalStreak: 0,
    dailyMission: initialDailyMission(),
    quizCurrentStreak: 0,
    totalNewsCoinsEarned: 0,
  };
}

function safeNonNegative(value: unknown, fallback: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return integer ? Math.floor(value) : value;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length <= 300))] : [];
}

function normalizeAnalysis(value: unknown): AnalyzedNews | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<AnalyzedNews>;
  if (!(Array.isArray(item.summary) && item.summary.length === 3 && item.summary.every((part) => typeof part === "string") &&
    typeof item.whyItMatters === "string" && ISSUE_IDS.includes(item.issueId as IssueId) &&
    typeof item.insufficient === "boolean" && !!item.quiz && typeof item.quiz.question === "string" &&
    Array.isArray(item.quiz.choices) && item.quiz.choices.length === 4 &&
    item.quiz.choices.every((choice) => typeof choice === "string") &&
    Number.isInteger(item.quiz.answerIndex) && item.quiz.answerIndex >= 0 && item.quiz.answerIndex <= 3 &&
    typeof item.quiz.explanation === "string")) return null;
  const raw = item.marketImpact as unknown as Record<string, unknown> | undefined;
  if (!raw || typeof raw.reason !== "string") return null;
  const direction = raw.direction === "positive" ? "UP" : raw.direction === "negative" ? "DOWN" : raw.direction === "neutral" ? "NEUTRAL" : raw.direction;
  if (direction !== "UP" && direction !== "DOWN" && direction !== "NEUTRAL") return null;
  const issueId = item.issueId as IssueId;
  return {
    summary: item.summary as AnalyzedNews["summary"],
    whyItMatters: item.whyItMatters as string,
    issueId,
    marketImpact: {
      relatedIssue: issueId,
      direction,
      magnitude: direction === "NEUTRAL" ? 0 : clampMagnitude(typeof raw.magnitude === "number" ? raw.magnitude : 3),
      reason: raw.reason,
    },
    quiz: item.quiz as AnalyzedNews["quiz"],
    insufficient: item.insufficient as boolean,
  };
}

const shortString = (value: unknown, max = 300): string => typeof value === "string" ? value.slice(0, max) : "";

function normalizePrediction(value: unknown): Prediction | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (!ISSUE_IDS.includes(raw.selectedIssue as IssueId) ||
      !["UP", "NEUTRAL", "DOWN"].includes(raw.selectedDirection as string) ||
      ![10, 20, 30].includes(raw.betAmount as number) ||
      !["EXACT", "DIRECTION_ONLY", "MISS"].includes(raw.result as string) ||
      typeof raw.profit !== "number" || !Number.isFinite(raw.profit)) return undefined;
  return raw as Prediction;
}

function normalizeHistory(value: unknown): NewsActivity[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, NewsActivity>();
  for (const raw of value.slice(-100)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const articleId = shortString(item.articleId);
    const title = shortString(item.title);
    const originalLink = shortString(item.originalLink, 1000);
    if (!articleId || !title || !NEWS_CATEGORIES.includes(item.category as NewsActivity["category"]) ||
        !/^https?:\/\//i.test(originalLink)) continue;
    const prediction = normalizePrediction(item.prediction);
    byId.set(articleId, {
      articleId, title, category: item.category as NewsActivity["category"],
      source: shortString(item.source), publishedAt: shortString(item.publishedAt, 80),
      viewedAt: Number.isFinite(Date.parse(shortString(item.viewedAt))) ? shortString(item.viewedAt) : new Date().toISOString(),
      originalLink,
      summary: Array.isArray(item.summary) ? item.summary.filter((part): part is string => typeof part === "string").slice(0, 3).map((part) => part.slice(0, 500)) : [],
      importance: shortString(item.importance, 500), isLive: item.isLive === true,
      quizAnswered: item.quizAnswered === true, quizCorrect: item.quizCorrect === true,
      quizAttempts: Math.min(2, safeNonNegative(item.quizAttempts, 0, true)),
      quizReward: safeNonNegative(item.quizReward, 0, true), hackEvent: item.hackEvent === true,
      ...(prediction ? { prediction } : {}),
    });
  }
  return [...byId.values()].slice(-100);
}

function normalizeDaily(value: unknown): DailyMissionState {
  const base = initialDailyMission();
  if (!value || typeof value !== "object") return base;
  const raw = value as Record<string, unknown>;
  const claimed = raw.claimed && typeof raw.claimed === "object" ? raw.claimed as Record<string, unknown> : {};
  return {
    date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : base.date,
    readArticleIds: stringList(raw.readArticleIds).slice(0, 3),
    quizStreak: Math.min(2, safeNonNegative(raw.quizStreak, 0, true)),
    predictedArticleIds: stringList(raw.predictedArticleIds).slice(0, 1),
    claimed: Object.fromEntries(MISSION_IDS.map((id) => [id, claimed[id] === true])) as DailyMissionState["claimed"],
    allClaimed: raw.allClaimed === true,
  };
}

export function normalizeUserState(value: unknown, rollover = true): UserState {
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
    const normalized = normalizeAnalysis(analysis);
    if (key.length <= 300 && normalized) cachedAnalyses[key] = normalized;
  }
  const rawAttempts = data.quizAttempts && typeof data.quizAttempts === "object" ? data.quizAttempts as Record<string, unknown> : {};
  const quizAttempts: Record<string, number> = {};
  for (const [key, count] of Object.entries(rawAttempts)) {
    if (key.length <= 300 && typeof count === "number" && Number.isFinite(count)) quizAttempts[key] = Math.min(2, Math.max(0, Math.floor(count)));
  }
  const completedQuizIds = stringList(data.completedQuizIds);
  const legacyNewsEarnings = completedQuizIds.reduce((total, id) => {
    const attempts = quizAttempts[id] ?? 0;
    return total + (attempts === 0 ? 100 : attempts === 1 ? 50 : 0);
  }, 0);
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
    if (typeof price.currentPrice !== "number" || !Number.isFinite(price.currentPrice) || price.currentPrice < 10 ||
        typeof price.previousPrice !== "number" || !Number.isFinite(price.previousPrice) || price.previousPrice < 10 ||
        !Array.isArray(price.priceHistory) || !price.priceHistory.length ||
        !price.priceHistory.every((item) => typeof item === "number" && Number.isFinite(item) && item >= 10) ||
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
  const processedImpactIds = stringList(data.processedImpactIds);
  const rawHackEvents = data.hackEvents && typeof data.hackEvents === "object" ? data.hackEvents as Record<string, unknown> : {};
  const hackEvents: Record<string, HackEventState> = {};
  for (const [id, value] of Object.entries(rawHackEvents)) {
    if (id.length > 300 || !value || typeof value !== "object") continue;
    const raw = value as Record<string, unknown>;
    const prediction = normalizePrediction(raw.prediction);
    const pendingAnalysis = raw.active === true && raw.resolved !== true ? normalizeAnalysis(raw.pendingAnalysis) : null;
    hackEvents[id] = { active: raw.active === true, resolved: raw.resolved === true,
      ...(prediction ? { prediction } : {}), ...(pendingAnalysis ? { pendingAnalysis } : {}) };
  }
  for (const id of processedImpactIds) {
    if (!hackEvents[id]) hackEvents[id] = { active: false, resolved: true };
  }
  const happyDailyDate = typeof data.happyDailyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.happyDailyDate)
    ? data.happyDailyDate : localDateKey();
  const normalized: UserState = {
    version: 2,
    coins: legacyFreshBalance ? INITIAL_COINS : Math.round(safeNonNegative(data.coins, INITIAL_COINS) * 100) / 100,
    happyTypingCount: safeNonNegative(data.happyTypingCount, 0, true),
    happyDailyDate,
    happyDailyEarned: safeNonNegative(data.happyDailyEarned, 0, true),
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
    processedImpactIds,
    newsHistory: normalizeHistory(data.newsHistory),
    hackEvents,
    hackNormalStreak: Math.min(4, safeNonNegative(data.hackNormalStreak, 0, true)),
    dailyMission: normalizeDaily(data.dailyMission),
    quizCurrentStreak: safeNonNegative(data.quizCurrentStreak, 0, true),
    totalNewsCoinsEarned: typeof data.totalNewsCoinsEarned === "number" && Number.isFinite(data.totalNewsCoinsEarned)
      ? Math.trunc(data.totalNewsCoinsEarned) : legacyNewsEarnings,
  };
  return rollover ? rolloverDailyState(normalized, now) : normalized;
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
