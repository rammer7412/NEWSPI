import { applyIssueImpact } from "@/lib/market";
import { ISSUE_IDS, MISSION_IDS, type AnalyzedNews, type DailyMissionState, type IssueId, type MarketDirection, type MarketImpact, type MissionId, type NewsActivity, type NewsArticle, type Prediction, type UserState } from "@/types";

export const HACK_EVENT_CHANCE = 0.2;
export const INITIAL_COINS = 100;
export const FIRST_TRY_QUIZ_REWARD = 25;
export const RETRY_QUIZ_REWARD = 10;
export const HAPPY_DAILY_LIMIT = 10;
export const MISSION_REWARD = 20;
export const BET_AMOUNTS = [10, 20, 30] as const;

export function localDateKey(now = Date.now()): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function initialDailyMission(date = localDateKey()): DailyMissionState {
  return {
    date,
    readArticleIds: [],
    quizStreak: 0,
    predictedArticleIds: [],
    claimed: { explorer: false, streak: false, hacker: false },
    allClaimed: false,
  };
}

export function rolloverDailyState(state: UserState, now = Date.now()): UserState {
  const date = localDateKey(now);
  if (state.dailyMission.date === date && state.happyDailyDate === date) return state;
  return {
    ...state,
    dailyMission: state.dailyMission.date === date ? state.dailyMission : initialDailyMission(date),
    happyDailyDate: date,
    happyDailyEarned: state.happyDailyDate === date ? state.happyDailyEarned : 0,
  };
}

export function decideHackEvent(normalStreak: number, sample: number): { active: boolean; nextStreak: number } {
  const active = normalStreak >= 4 || sample < HACK_EVENT_CHANCE;
  return { active, nextStreak: active ? 0 : normalStreak + 1 };
}

export function registerAnalyzedArticle(state: UserState, articleId: string, analysis: AnalyzedNews,
  available: boolean, sample: number): UserState {
  const existingEvent = state.hackEvents[articleId];
  const eligible = available && !analysis.insufficient && !existingEvent;
  const decision = eligible ? decideHackEvent(state.hackNormalStreak, sample) : null;
  const hackEvent = existingEvent?.active ?? decision?.active ?? false;
  return {
    ...state,
    newsHistory: state.newsHistory.map((item) => item.articleId === articleId
      ? { ...item,
        summary: hackEvent && !existingEvent?.resolved ? item.summary : analysis.summary.filter(Boolean),
        importance: hackEvent && !existingEvent?.resolved ? item.importance : analysis.whyItMatters,
        hackEvent } : item),
    ...(decision ? {
      hackEvents: { ...state.hackEvents, [articleId]: { active: decision.active, resolved: !decision.active,
        ...(decision.active ? { pendingAnalysis: analysis } : {}) } },
      hackNormalStreak: decision.nextStreak,
    } : {}),
  };
}

export function canEarnHappyCoin(state: UserState): boolean {
  return state.coins < 10 && state.happyDailyEarned < HAPPY_DAILY_LIMIT;
}

export function applyHappyReward(state: UserState): UserState {
  if (!canEarnHappyCoin(state)) return state;
  return {
    ...state,
    coins: Math.round((state.coins + 1) * 100) / 100,
    happyTypingCount: state.happyTypingCount + 1,
    happyDailyEarned: state.happyDailyEarned + 1,
  };
}

export function settlePrediction(
  selectedIssue: IssueId,
  selectedDirection: MarketDirection,
  betAmount: number,
  actualIssue: IssueId,
  actualDirection: MarketDirection,
): { prediction: Prediction; payout: number } {
  const directionMatches = selectedDirection === actualDirection;
  const result = directionMatches ? (selectedIssue === actualIssue ? "EXACT" : "DIRECTION_ONLY") : "MISS";
  const payout = result === "EXACT" ? betAmount * 2 : result === "DIRECTION_ONLY" ? betAmount : 0;
  return { prediction: { selectedIssue, selectedDirection, betAmount, result, profit: payout - betAmount }, payout };
}

export function recordArticleView(state: UserState, article: NewsArticle, viewedAt = new Date().toISOString()): UserState {
  const existing = state.newsHistory.find((item) => item.articleId === article.id);
  const completedBefore = state.completedQuizIds.includes(article.id);
  const priorAttempts = state.quizAttempts[article.id] ?? 0;
  const savedEvent = state.hackEvents[article.id];
  const savedPrediction = existing?.prediction ?? savedEvent?.prediction;
  const record: NewsActivity = {
    articleId: article.id, title: article.title, category: article.category,
    source: article.source || "출처 확인", publishedAt: article.publishedAt,
    viewedAt, originalLink: article.sourceUrl, summary: existing?.summary ?? [],
    importance: existing?.importance ?? "", isLive: !article.isFallback,
    quizAnswered: existing?.quizAnswered ?? (completedBefore || priorAttempts > 0),
    quizCorrect: existing?.quizCorrect ?? completedBefore,
    quizAttempts: existing?.quizAttempts ?? priorAttempts, quizReward: existing?.quizReward ?? 0,
    hackEvent: existing?.hackEvent ?? (savedEvent?.active ?? false),
    ...(savedPrediction ? { prediction: savedPrediction } : {}),
  };
  const readArticleIds = state.dailyMission.readArticleIds.includes(article.id) || state.dailyMission.readArticleIds.length >= 3
    ? state.dailyMission.readArticleIds : [...state.dailyMission.readArticleIds, article.id];
  return {
    ...state,
    seenNewsIds: [...new Set([...state.seenNewsIds, article.id])].slice(-100),
    newsHistory: [...state.newsHistory.filter((item) => item.articleId !== article.id), record].slice(-100),
    dailyMission: { ...state.dailyMission, readArticleIds },
  };
}

export function applyWrongQuizAnswer(state: UserState, id: string): UserState {
  const attempts = state.quizAttempts[id] ?? 0;
  if (state.completedQuizIds.includes(id) || attempts >= 2) return state;
  const nextAttempts = attempts + 1;
  return {
    ...state,
    quizAttempts: { ...state.quizAttempts, [id]: nextAttempts },
    quizCurrentStreak: 0,
    dailyMission: { ...state.dailyMission, quizStreak: 0 },
    newsHistory: state.newsHistory.map((item) => item.articleId === id
      ? { ...item, quizAnswered: true, quizCorrect: false, quizAttempts: nextAttempts } : item),
  };
}

export function applyQuizAward(state: UserState, id: string): UserState {
  const attempts = state.quizAttempts[id] ?? 0;
  if (state.completedQuizIds.includes(id) || attempts >= 2) return state;
  const reward = attempts === 0 ? FIRST_TRY_QUIZ_REWARD : RETRY_QUIZ_REWARD;
  return {
    ...state,
    coins: Math.round((state.coins + reward) * 100) / 100,
    completedQuizIds: [...state.completedQuizIds, id],
    quizCurrentStreak: state.quizCurrentStreak + 1,
    totalNewsCoinsEarned: state.totalNewsCoinsEarned + reward,
    dailyMission: { ...state.dailyMission, quizStreak: Math.min(2, state.dailyMission.quizStreak + 1) },
    newsHistory: state.newsHistory.map((item) => item.articleId === id
      ? { ...item, quizAnswered: true, quizCorrect: true, quizAttempts: attempts + 1, quizReward: reward } : item),
  };
}

export function applyArticleImpactOnce(state: UserState, articleId: string, impact: MarketImpact): UserState {
  const event = state.hackEvents[articleId];
  if (state.processedImpactIds.includes(articleId) || (event?.active && !event.resolved)) return state;
  return {
    ...state,
    market: applyIssueImpact(state.market, impact.relatedIssue, impact.direction, impact.magnitude),
    processedImpactIds: [...state.processedImpactIds, articleId],
  };
}

export function finalizeHackOnce(state: UserState, articleId: string, impact: MarketImpact,
  selectedIssue?: IssueId, selectedDirection?: MarketDirection, betAmount = 0): UserState {
  const event = state.hackEvents[articleId];
  if (!event?.active || event.resolved) return state;
  if (betAmount === 0) {
    if (state.coins >= 10) return state;
  } else if (!selectedIssue || !ISSUE_IDS.includes(selectedIssue) || !selectedDirection ||
      !["UP", "NEUTRAL", "DOWN"].includes(selectedDirection) ||
      !BET_AMOUNTS.some((amount) => amount === betAmount) || state.coins < betAmount) return state;
  const settlement = betAmount && selectedIssue && selectedDirection
    ? settlePrediction(selectedIssue, selectedDirection, betAmount, impact.relatedIssue, impact.direction) : null;
  const prediction = settlement?.prediction;
  const newlyApplied = !state.processedImpactIds.includes(articleId);
  const predictedArticleIds = prediction && !state.dailyMission.predictedArticleIds.includes(articleId) &&
    state.dailyMission.predictedArticleIds.length < 1
    ? [...state.dailyMission.predictedArticleIds, articleId] : state.dailyMission.predictedArticleIds;
  return {
    ...state,
    coins: Math.round((state.coins - betAmount + (settlement?.payout ?? 0)) * 100) / 100,
    totalNewsCoinsEarned: state.totalNewsCoinsEarned + (prediction?.profit ?? 0),
    market: newlyApplied ? applyIssueImpact(state.market, impact.relatedIssue, impact.direction, impact.magnitude) : state.market,
    processedImpactIds: newlyApplied ? [...state.processedImpactIds, articleId] : state.processedImpactIds,
    hackEvents: { ...state.hackEvents, [articleId]: { active: true, resolved: true, ...(prediction ? { prediction } : {}) } },
    dailyMission: { ...state.dailyMission, predictedArticleIds },
    newsHistory: state.newsHistory.map((item) => item.articleId === articleId
      ? { ...item, hackEvent: true,
        summary: event.pendingAnalysis?.summary.filter(Boolean) ?? item.summary,
        importance: event.pendingAnalysis?.whyItMatters ?? item.importance,
        ...(prediction ? { prediction } : {}) } : item),
  };
}

export function missionProgress(daily: DailyMissionState, id: MissionId): number {
  if (id === "explorer") return Math.min(3, daily.readArticleIds.length);
  if (id === "streak") return Math.min(2, daily.quizStreak);
  return Math.min(1, daily.predictedArticleIds.length);
}

export function claimMissionReward(state: UserState, id: MissionId): UserState {
  if (!MISSION_IDS.includes(id) || state.dailyMission.claimed[id]) return state;
  const target = id === "explorer" ? 3 : id === "streak" ? 2 : 1;
  if (missionProgress(state.dailyMission, id) < target) return state;
  return {
    ...state,
    coins: Math.round((state.coins + MISSION_REWARD) * 100) / 100,
    dailyMission: { ...state.dailyMission, claimed: { ...state.dailyMission.claimed, [id]: true } },
  };
}

export function claimAllMissionReward(state: UserState): UserState {
  if (state.dailyMission.allClaimed || !MISSION_IDS.every((id) => state.dailyMission.claimed[id])) return state;
  return {
    ...state,
    coins: Math.round((state.coins + MISSION_REWARD) * 100) / 100,
    dailyMission: { ...state.dailyMission, allClaimed: true },
  };
}
