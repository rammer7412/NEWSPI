import { NextRequest, NextResponse } from "next/server";
import { analyzeWithOpenAI, findDemoAnalysis, unavailableAnalysis, validateAnalyzeInput } from "@/lib/analyze-news";
import { fetchArticleText } from "@/lib/article-body";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "기사 정보를 읽을 수 없습니다." }, { status: 400 });
  }
  const input = validateAnalyzeInput(body);
  if (!input) return NextResponse.json({ message: "올바른 기사 정보가 필요합니다." }, { status: 400 });
  const demo = findDemoAnalysis(input);
  if (demo) return NextResponse.json({ analysis: demo, mode: "demo" });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      analysis: unavailableAnalysis(input), mode: "unavailable",
      message: "AI 키가 없어 원문 기반 퀴즈를 생성하지 못했습니다.",
    });
  }
  let articleText: string;
  try {
    articleText = await fetchArticleText(input.sourceUrl, input.naverUrl);
  } catch {
    return NextResponse.json({
      analysis: unavailableAnalysis(input), mode: "unavailable",
      message: "원문 본문을 읽지 못해 퀴즈를 생성하지 못했습니다. 다른 뉴스를 뽑아 주세요.",
    });
  }
  try {
    const analysis = await analyzeWithOpenAI(input, articleText);
    return NextResponse.json({ analysis, mode: "ai" });
  } catch {
    return NextResponse.json({
      analysis: unavailableAnalysis(input), mode: "unavailable",
      message: "AI 분석을 사용할 수 없어 기사 정보를 그대로 보여드립니다. 퀴즈를 생성하지 못했습니다.",
    });
  }
}
