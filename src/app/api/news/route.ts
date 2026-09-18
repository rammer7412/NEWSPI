import { NextRequest, NextResponse } from "next/server";
import { fetchNaverNews, getFallbackNews, NaverNewsError } from "@/lib/naver-news";
import { NEWS_CATEGORIES, type NewsCategory } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  if (!NEWS_CATEGORIES.includes(category as NewsCategory)) {
    return NextResponse.json({ message: "올바른 뉴스 분야를 선택해 주세요." }, { status: 400 });
  }
  const excluded = new Set(
    (request.nextUrl.searchParams.get("exclude") ?? "")
      .split(",")
      .slice(0, 40)
      .filter((id) => /^[a-zA-Z0-9-]{1,40}$/.test(id)),
  );

  try {
    const article = await fetchNaverNews(category as NewsCategory, excluded);
    return NextResponse.json({ article, mode: "live" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const article = getFallbackNews(category as NewsCategory, excluded);
    return NextResponse.json({
      article, mode: "demo", message: "실시간 뉴스를 불러오지 못해 데모 카드를 보여드립니다.",
      errorCode: error instanceof NaverNewsError ? error.code : "NAVER_REQUEST_FAILED",
    }, { headers: { "Cache-Control": "no-store" } });
  }
}
