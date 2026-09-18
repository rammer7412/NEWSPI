import { createHash, randomInt } from "node:crypto";
import fallbackData from "@/data/fallback-news.json";
import { cleanText, safeHttpUrl } from "@/lib/sanitize";
import type { FallbackNewsArticle, NewsArticle, NewsCategory } from "@/types";

const categoryQueries: Record<NewsCategory, string> = {
  domestic: "대한민국 주요 뉴스",
  world: "세계 국제 뉴스",
  economy: "경제 금융 주요 뉴스",
  technology: "인공지능 반도체 과학기술",
  society: "사회 주요 뉴스",
  culture: "문화 콘텐츠 주요 뉴스",
  sports: "스포츠 주요 뉴스",
};

type RawItem = { title?: unknown; description?: unknown; originallink?: unknown; link?: unknown; pubDate?: unknown };
export const fallbackNews = fallbackData as FallbackNewsArticle[];

type NaverNewsErrorCode =
  | "NAVER_CONFIG_MISSING"
  | "NAVER_AUTH_FAILED"
  | "NAVER_REQUEST_FAILED"
  | "NAVER_INVALID_JSON"
  | "NAVER_INVALID_RESPONSE"
  | "NAVER_NO_RESULTS";

export class NaverNewsError extends Error {
  constructor(readonly code: NaverNewsErrorCode) {
    super(code);
    this.name = "NaverNewsError";
  }
}

function idFor(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function chooseArticle<T extends NewsArticle>(articles: T[], excluded: Set<string>): T {
  const fresh = articles.filter((article) => !excluded.has(article.id));
  const pool = fresh.length ? fresh : articles;
  return pool[randomInt(pool.length)];
}

export function getFallbackNews(category: NewsCategory, excluded: Set<string>): NewsArticle {
  const candidates = fallbackNews.filter((article) => article.category === category);
  const { analysis: _analysis, ...article } = chooseArticle(candidates, excluded);
  void _analysis;
  return article;
}

function normalizeItem(item: RawItem, category: NewsCategory, now: number): NewsArticle | null {
  const title = cleanText(item.title);
  const description = cleanText(item.description);
  const sourceUrl = safeHttpUrl(item.originallink) ?? safeHttpUrl(item.link);
  if (!title || !sourceUrl || typeof item.pubDate !== "string") return null;
  const date = new Date(item.pubDate);
  const age = now - date.getTime();
  if (!Number.isFinite(age) || age < -60 * 60 * 1000 || age > 7 * 24 * 60 * 60 * 1000) return null;
  const naverUrl = safeHttpUrl(item.link) ?? undefined;
  const source = new URL(sourceUrl).hostname.replace(/^www\./, "");
  return {
    id: idFor(sourceUrl), title, description, sourceUrl, naverUrl, source,
    publishedAt: date.toISOString(), category, isFallback: false,
  };
}

export async function fetchNaverNews(category: NewsCategory, excluded: Set<string>): Promise<NewsArticle> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new NaverNewsError("NAVER_CONFIG_MISSING");

  const url = new URL("https://naverapihub.apigw.ntruss.com/search/v1/news");
  url.searchParams.set("query", categoryQueries[category]);
  url.searchParams.set("display", "30");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "date");
  url.searchParams.set("format", "json");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "X-NCP-APIGW-API-KEY-ID": clientId, "X-NCP-APIGW-API-KEY": clientSecret },
      signal: AbortSignal.timeout(8000), cache: "no-store",
    });
  } catch {
    throw new NaverNewsError("NAVER_REQUEST_FAILED");
  }
  if (response.status === 401 || response.status === 403) throw new NaverNewsError("NAVER_AUTH_FAILED");
  if (!response.ok) throw new NaverNewsError("NAVER_REQUEST_FAILED");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new NaverNewsError("NAVER_INVALID_JSON");
  }
  if (!body || typeof body !== "object" || !("items" in body) || !Array.isArray(body.items)) {
    throw new NaverNewsError("NAVER_INVALID_RESPONSE");
  }

  const now = Date.now();
  const normalized = body.items
    .filter((item): item is RawItem => !!item && typeof item === "object")
    .map((item) => normalizeItem(item, category, now))
    .filter((item): item is NewsArticle => item !== null);
  const unique = new Map<string, NewsArticle>();
  const titles = new Set<string>();
  for (const item of normalized) {
    const titleKey = item.title.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
    if (unique.has(item.sourceUrl) || titles.has(titleKey)) continue;
    unique.set(item.sourceUrl, item);
    titles.add(titleKey);
  }
  if (unique.size === 0) throw new NaverNewsError("NAVER_NO_RESULTS");
  return chooseArticle([...unique.values()], excluded);
}
