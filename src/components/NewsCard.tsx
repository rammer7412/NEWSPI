"use client";

import { ArrowRight, ArrowUpRight, BookOpen, Clock3, ExternalLink, FileQuestion, LoaderCircle, Sparkles } from "lucide-react";
import { formatPublishedAt } from "@/lib/format";
import { ISSUE_BY_ID } from "@/data/market-issues";
import { CATEGORY_LABELS, type AnalysisMode, type AnalyzedNews, type NewsArticle } from "@/types";

type Props = {
  article: NewsArticle;
  analysis: AnalyzedNews | null;
  analysisMode: AnalysisMode | null;
  analysisLoading: boolean;
  onQuiz: () => void;
  onAnother: () => void;
  quizStarted: boolean;
};

export function NewsCard({ article, analysis, analysisMode, analysisLoading, onQuiz, onAnother, quizStarted }: Props) {
  const canQuiz = !!analysis && !analysis.insufficient && !!analysis.quiz.question;
  return (
    <article className="news-card glass-panel card-arrive">
      <div className="panel-topline"><span className="tag purple-tag"><BookOpen size={13} /> NEWS CARD</span><span className="panel-index">02 / READ</span></div>
      <div className="news-meta"><span className="category-badge">{CATEGORY_LABELS[article.category]}</span><span className={article.isFallback ? "source-badge demo" : "source-badge live"}>{article.isFallback ? "DEMO" : "LIVE"}</span><span className="news-time"><Clock3 size={13} /> {formatPublishedAt(article.publishedAt, article.isFallback)}</span></div>
      <h2 className="news-title">{article.title}</h2>
      <div className="news-source">SOURCE <span>{article.source || "출처 확인"}</span></div>
      <div className="card-rule" />
      <div className="analysis-heading"><span><Sparkles size={17} /> {article.isFallback ? "핵심 3줄 요약" : "AI 핵심 3줄 요약"}</span><small>{analysisMode === "unavailable" ? "ANALYSIS UNAVAILABLE" : analysisMode === "demo" ? "PREWRITTEN DEMO" : "SMART BRIEF"}</small></div>
      {analysisLoading ? <div className="analysis-loading"><LoaderCircle size={19} className="animate-spin" /><div><strong>원문 본문 확인 중...</strong><span>기사 가치 분석 중... · 시장 영향도 계산 중... · 퀴즈 계약서 발행 중...</span></div></div> : analysis ? (
        <div className="summary-list">{analysis.summary.filter(Boolean).map((line, index) => <div className="summary-line" key={`${index}-${line}`}><span>0{index + 1}</span><p>{line}</p></div>)}</div>
      ) : <p className="muted">분석 정보를 불러오지 못했습니다.</p>}
      {analysis && <div className="why-box"><span>WHY IT MATTERS</span><p>{analysis.whyItMatters}</p></div>}
      {analysis && analysisMode !== "unavailable" && <div className={`market-signal ${analysis.marketImpact.direction}`}>
        <strong>{ISSUE_BY_ID[analysis.issueId].name} · {analysis.marketImpact.direction === "positive" ? "호재" : analysis.marketImpact.direction === "negative" ? "악재" : "중립"}</strong>
        <span>{analysis.marketImpact.reason}</span>
      </div>}
      {analysisMode === "unavailable" && <p className="inline-alert">원문 본문을 읽지 못했거나 AI 분석을 사용할 수 없어 퀴즈를 생성하지 못했습니다.</p>}
      {analysis?.insufficient && analysisMode !== "unavailable" && <p className="inline-alert">제공된 정보가 부족해 사실 확인 가능한 퀴즈를 만들 수 없습니다.</p>}
      <div className="news-actions">
        <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="outline-button"><ExternalLink size={15} /> {article.isFallback ? "주제 참고 사이트" : "원문 기사 보기"}</a>
        {canQuiz && !quizStarted && <button className="primary-button" onClick={onQuiz}><FileQuestion size={17} /> 퀴즈 시작 <ArrowRight size={17} /></button>}
        {(!canQuiz && !analysisLoading) && <button className="outline-button" onClick={onAnother}>다른 뉴스 뽑기 <ArrowUpRight size={16} /></button>}
      </div>
    </article>
  );
}
