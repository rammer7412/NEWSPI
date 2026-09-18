export const NEWS_CATEGORIES = ["domestic", "world", "economy", "technology", "society", "culture", "sports"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<NewsCategory, string> = {
  domestic: "국내", world: "세계", economy: "경제", technology: "기술",
  society: "사회", culture: "문화", sports: "스포츠",
};

export const ISSUE_IDS = ["AI_TECH", "SEMICONDUCTOR", "ECONOMY", "GLOBAL", "SOCIETY", "CULTURE", "SPORTS"] as const;
export type IssueId = (typeof ISSUE_IDS)[number];

export type NewsArticle = {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  naverUrl?: string;
  source?: string;
  publishedAt: string;
  category: NewsCategory;
  isFallback: boolean;
};

export type Quiz = {
  question: string;
  choices: [string, string, string, string];
  answerIndex: number;
  explanation: string;
};

export type MarketDirection = "UP" | "NEUTRAL" | "DOWN";
export type MarketImpact = {
  relatedIssue: IssueId;
  direction: MarketDirection;
  magnitude: number;
  reason: string;
};

export type AnalyzedNews = {
  summary: [string, string, string];
  whyItMatters: string;
  issueId: IssueId;
  marketImpact: MarketImpact;
  quiz: Quiz;
  insufficient: boolean;
};

export type FallbackNewsArticle = NewsArticle & { analysis: AnalyzedNews };
export type AnalysisMode = "ai" | "demo" | "unavailable";

export type MarketIssue = {
  id: IssueId;
  name: string;
  currentPrice: number;
  previousPrice: number;
  priceHistory: number[];
};

export type MarketPrice = Pick<MarketIssue, "currentPrice" | "previousPrice" | "priceHistory">;

export type Holding = { quantity: number; averagePrice: number };
export type PredictionResult = "EXACT" | "DIRECTION_ONLY" | "MISS";
export type Prediction = {
  selectedIssue: IssueId;
  selectedDirection: MarketDirection;
  betAmount: number;
  result: PredictionResult;
  profit: number;
};
export type NewsActivity = {
  articleId: string;
  title: string;
  category: NewsCategory;
  source: string;
  publishedAt: string;
  viewedAt: string;
  originalLink: string;
  summary: string[];
  importance: string;
  isLive: boolean;
  quizAnswered: boolean;
  quizCorrect: boolean;
  quizAttempts: number;
  quizReward: number;
  hackEvent: boolean;
  prediction?: Prediction;
};
export type HackEventState = { active: boolean; resolved: boolean; prediction?: Prediction; pendingAnalysis?: AnalyzedNews };
export type LongShortDirection = "LONG" | "SHORT";
export type LongShortStatus = "OPEN" | "WON" | "LOST" | "DRAW";
export type LongShortBet = {
  id: string;
  assetId: IssueId;
  direction: LongShortDirection;
  stake: number;
  entryPrice: number;
  exitPrice: number | null;
  payout: number | null;
  status: LongShortStatus;
  openedAt: number;
  expiresAt: number;
  settledAt: number | null;
};
export type LongShortSnapshot = { active: LongShortBet | null; recent: LongShortBet[]; settledBet?: LongShortBet | null; serverNow?: number; receivedAt?: number };
export const MISSION_IDS = ["explorer", "streak", "hacker"] as const;
export type MissionId = (typeof MISSION_IDS)[number];
export type DailyMissionState = {
  date: string;
  readArticleIds: string[];
  quizStreak: number;
  predictedArticleIds: string[];
  claimed: Record<MissionId, boolean>;
  allClaimed: boolean;
};
export type UserState = {
  version: number;
  coins: number;
  happyTypingCount: number;
  happyDailyDate: string;
  happyDailyEarned: number;
  holdings: Record<IssueId, Holding>;
  completedQuizIds: string[];
  quizAttempts: Record<string, number>;
  seenNewsIds: string[];
  cachedAnalyses: Record<string, AnalyzedNews>;
  analysisCacheOrder?: string[];
  currentDay: number;
  market: Record<IssueId, MarketPrice>;
  nextMarketTickAt: number;
  marketTickCount: number;
  processedImpactIds: string[];
  newsHistory: NewsActivity[];
  hackEvents: Record<string, HackEventState>;
  hackNormalStreak: number;
  dailyMission: DailyMissionState;
  quizCurrentStreak: number;
  totalNewsCoinsEarned: number;
};
