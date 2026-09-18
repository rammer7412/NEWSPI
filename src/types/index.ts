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

export type AnalyzedNews = {
  summary: [string, string, string];
  whyItMatters: string;
  issueId: IssueId;
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
  dailyChanges: number[];
};

export type Holding = { quantity: number; averagePrice: number };
export type UserState = {
  coins: number;
  happyTypingCount: number;
  holdings: Record<IssueId, Holding>;
  completedQuizIds: string[];
  quizAttempts: Record<string, number>;
  seenNewsIds: string[];
  cachedAnalyses: Record<string, AnalyzedNews>;
  currentDay: number;
};
