"use client";

import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, CircleHelp, Coins, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Header, type Tab } from "@/components/Header";
import { DailyMissions } from "@/components/DailyMissions";
import { HackPanel } from "@/components/HackPanel";
import { HappyDwi } from "@/components/HappyDwi";
import { MarketBoard } from "@/components/MarketBoard";
import { NewsCard } from "@/components/NewsCard";
import { NewsRoulette } from "@/components/NewsRoulette";
import { NewspiMark } from "@/components/NewspiMark";
import { NewsHistory } from "@/components/NewsHistory";
import { Portfolio } from "@/components/Portfolio";
import { QuizPanel } from "@/components/QuizPanel";
import { Shop } from "@/components/Shop";
import { ISSUE_BY_ID } from "@/data/market-issues";
import { equippedTitleLabel, shopThemeClass } from "@/data/shop-items";
import { ROULETTE_COST, useUserState } from "@/hooks/useUserState";
import { formatCoin, formatPercent } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { changePercent, getMarketIssues, issueForCategory, portfolioTotals } from "@/lib/market";
import { NEWS_CATEGORIES, type AnalysisMode, type AnalyzedNews, type IssueId, type NewsArticle, type NewsCategory } from "@/types";

type NewsResponse = { article?: NewsArticle; mode?: "live" | "demo"; message?: string };
type AnalyzeResponse = { analysis?: AnalyzedNews; mode?: AnalysisMode; message?: string };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function unavailableFor(article: NewsArticle): AnalyzedNews {
  return {
    summary: [article.title, article.description || "기사 설명이 제공되지 않았습니다.", ""],
    whyItMatters: "AI 분석을 사용할 수 없습니다. 원문에서 내용을 확인해 주세요.",
    issueId: issueForCategory(article.category),
    marketImpact: { relatedIssue: issueForCategory(article.category), direction: "NEUTRAL", magnitude: 0, reason: "기사의 시장 영향을 확인할 수 없습니다." },
    quiz: { question: "", choices: ["", "", "", ""], answerIndex: 0, explanation: "" },
    insufficient: true,
  };
}

export default function Home() {
  const { state, hydrated, loadingError, actionError, busy, retryLoad, secondsToNextTick, recordNewsView, registerAnalysis, cacheAnalysis, spendRouletteCoins, refundRouletteCoins, earnHappyCoin,
    recordWrongAttempt, awardQuiz, buy, sell, applyNewsImpact, resolveHack, claimMission, claimAllMissions,
    purchaseItem, equipItem, reset, longShort, openLongShort, settleLongShort } = useUserState();
  const [tab, setTab] = useState<Tab>("home");
  const [selectedIssue, setSelectedIssue] = useState<IssueId>("AI_TECH");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | null>(null);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzedNews | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newsError, setNewsError] = useState(false);
  const spinRequest = useRef(0);
  const spinLock = useRef(false);

  const market = useMemo(() => getMarketIssues(state), [state]);
  const totals = useMemo(() => portfolioTotals(state, market), [state, market]);
  const hackEvent = article ? state.hackEvents[article.id] : undefined;
  const analysisLocked = !!hackEvent?.active && !hackEvent.resolved && analysisMode !== "unavailable";

  async function reflectMarketImpact(picked: NewsArticle, analyzed: AnalyzedNews) {
    const { direction } = analyzed.marketImpact;
    const result = await applyNewsImpact(picked.id, analyzed.marketImpact);
    if (!result.applied || direction === "NEUTRAL") return;
    const issueName = ISSUE_BY_ID[analyzed.marketImpact.relatedIssue].name;
    const rate = ((result.after - result.before) / result.before) * 100;
    setNotice(`${picked.isFallback ? "DEMO · " : ""}${issueName} ${direction === "UP" ? "호재" : "악재"} 반영: ${formatPercent(rate)} (${formatCoin(result.before)} → ${formatCoin(result.after)})`);
  }

  async function showAnalysis(picked: NewsArticle, analyzed: AnalyzedNews, mode: AnalysisMode) {
    const event = await registerAnalysis(picked, analyzed, mode !== "unavailable");
    setAnalysis(analyzed);
    setAnalysisMode(mode);
    if (mode !== "unavailable" && (!event.active || event.resolved)) await reflectMarketImpact(picked, analyzed);
  }

  async function spin() {
    if (!hydrated || spinLock.current) return;
    spinLock.current = true;
    try {
      if (!await spendRouletteCoins()) {
        setNotice(`룰렛에는 ${ROULETTE_COST} C가 필요합니다. 행복한 뒤주에서 코인을 모아 보세요.`);
        spinLock.current = false;
        return;
      }
    } catch {
      setNotice("룰렛 비용을 저장하지 못했습니다. 다시 시도해 주세요.");
      spinLock.current = false;
      return;
    }
    const requestId = ++spinRequest.current;
    const category = NEWS_CATEGORIES[Math.floor(Math.random() * NEWS_CATEGORIES.length)];
    const index = NEWS_CATEGORIES.indexOf(category);
    const sector = 360 / NEWS_CATEGORIES.length;
    setRotation((previous) => {
      const currentMod = ((previous % 360) + 360) % 360;
      const targetMod = ((-(index + 0.5) * sector % 360) + 360) % 360;
      const clockwiseDelta = (targetMod - currentMod + 360) % 360;
      return previous + 360 * 4 + clockwiseDelta;
    });
    setSpinning(true);
    setSelectedCategory(null);
    setArticle(null);
    setAnalysis(null);
    setAnalysisMode(null);
    setQuizStarted(false);
    setAnalysisLoading(false);
    setNotice(null);
    setNewsError(false);

    try {
      const query = new URLSearchParams({ category, exclude: state.seenNewsIds.slice(-40).join(",") });
      const responsePromise = fetch(`/api/news?${query.toString()}`, { cache: "no-store" });
      const [response] = await Promise.all([responsePromise, wait(2300)]);
      if (requestId !== spinRequest.current) return;
      if (!response.ok) throw new Error("NEWS_REQUEST_FAILED");
      const data = await response.json() as NewsResponse;
      if (!data.article || !data.article.id || !data.article.sourceUrl) throw new Error("NEWS_INVALID_RESPONSE");
      const picked = data.article;
      setSelectedCategory(category);
      setArticle(picked);
      await recordNewsView(picked);
      setSpinning(false);
      spinLock.current = false;
      if (data.mode === "demo") setNotice(data.message || "샘플 데이터 사용 중입니다.");

      const analysisCacheKey = `market-impact-v2:${picked.id}`;
      const cached = state.cachedAnalyses[analysisCacheKey] ?? state.hackEvents[picked.id]?.pendingAnalysis;
      if (cached) {
        await showAnalysis(picked, cached, picked.isFallback ? "demo" : "ai");
        return;
      }
      setAnalysisLoading(true);
      try {
        const result = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: picked.title, description: picked.description,
            sourceUrl: picked.sourceUrl, naverUrl: picked.naverUrl,
            category: picked.category, publishedAt: picked.publishedAt,
          }),
        });
        if (!result.ok) throw new Error("ANALYZE_REQUEST_FAILED");
        const analyzed = await result.json() as AnalyzeResponse;
        if (requestId !== spinRequest.current) return;
        if (!analyzed.analysis || !analyzed.mode) throw new Error("ANALYZE_INVALID_RESPONSE");
        await showAnalysis(picked, analyzed.analysis, analyzed.mode);
        if (analyzed.mode !== "unavailable") {
          await cacheAnalysis(analysisCacheKey, analyzed.analysis);
        }
        if (analyzed.mode === "unavailable") setNotice(analyzed.message || "AI 분석을 사용할 수 없습니다.");
      } catch {
        if (requestId !== spinRequest.current) return;
        setAnalysis(unavailableFor(picked));
        setAnalysisMode("unavailable");
        setNotice("AI 분석을 사용할 수 없어 기사 정보만 표시합니다.");
      } finally {
        if (requestId === spinRequest.current) setAnalysisLoading(false);
      }
    } catch {
      if (requestId !== spinRequest.current) return;
      setSpinning(false);
      spinLock.current = false;
      await Promise.resolve(refundRouletteCoins()).catch(() => undefined);
      setNewsError(true);
      setNotice(`뉴스를 불러오지 못해 사용한 ${ROULETTE_COST} C를 돌려드렸습니다. 다시 시도해 주세요.`);
    }
  }

  function goToMarket(id?: IssueId) {
    if (id) setSelectedIssue(id);
    setTab("market");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleReset() {
    if (window.confirm("코인, 보유 이슈, 뉴스 기록, 해킹 이벤트, 오늘의 미션과 상점 구매 내역을 모두 초기화할까요?")) {
      spinRequest.current += 1;
      spinLock.current = false;
      try { await reset(); }
      catch { setNotice("데이터를 초기화하지 못했습니다. 다시 시도해 주세요."); return; }
      setArticle(null);
      setAnalysis(null);
      setQuizStarted(false);
      setSpinning(false);
      setNewsError(false);
      setSelectedCategory(null);
      setRotation(0);
      setNotice("데이터를 초기화했습니다. 다시 뉴스 룰렛을 돌려보세요.");
      setTab("home");
    }
  }

  if (!hydrated) return <div className="site-wrap"><main className="app-shell"><section className="placeholder-card glass-panel loading-card" role="status"><LoaderCircle size={36} className="animate-spin" /><h2>{loadingError ? "게임 데이터를 불러오지 못했어요" : "NEWSPI 입장 준비 중..."}</h2><p>{loadingError || "익명 세션과 게임 기록을 확인하고 있습니다."}</p>{loadingError && <button className="primary-button" onClick={retryLoad}>다시 시도</button>}</section></main></div>;

  return <div className={`site-wrap ${shopThemeClass(state.equippedTheme)}`}>
    <Header tab={tab} onTabChange={setTab} coins={state.coins} totalAssets={totals.totalAssets} secondsToNextTick={secondsToNextTick} playerTitle={equippedTitleLabel(state.equippedTitle)} onReset={handleReset} />
    <main className="app-shell">
      {actionError && <div className="status-banner" role="alert"><ShieldCheck size={16} /><span>{actionError}</span></div>}
      {!isSupabaseConfigured && <div className="status-banner" role="status"><ShieldCheck size={16} /><span>Supabase가 설정되지 않아 Local Demo Mode로 실행 중입니다.</span></div>}
      {tab === "home" && <>
        <section className="hero"><div className="hero-copy"><span className="hero-overline"><span className="live-dot" /> THE NEWS GAME BEGINS</span><h1>뉴스를 뽑고,<br /><span>읽고, 투자하라<span className="title-dot">.</span></span></h1><p>읽으면 벌고, 알면 오른다.<br />오늘의 뉴스를 게임처럼 경험해 보세요.</p><div className="hero-proof"><span><BookOpen size={15} /> 7개 뉴스 분야</span><span><CircleHelp size={15} /> 지식 퀴즈</span><span><Coins size={15} /> 가상 코인</span></div></div><div className="hero-decor" aria-hidden="true"><div className="decor-ring ring-one" /><div className="decor-ring ring-two" /><span className="decor-symbol"><NewspiMark /></span><span className="decor-star star-one">✦</span><span className="decor-star star-two">✦</span></div></section>
        {notice && <div className="status-banner" role="status"><ShieldCheck size={16} /><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="알림 닫기">×</button></div>}
        <div className="home-grid"><NewsRoulette rotation={rotation} spinning={spinning} selectedCategory={selectedCategory} onSpin={spin} disabled={!hydrated || busy} canAfford={state.coins >= ROULETTE_COST} onOpenHappy={() => setTab("happy")} cost={ROULETTE_COST} /><div className="home-right">
          {spinning ? <div className="placeholder-card glass-panel loading-card"><span className="tag purple-tag"><LoaderCircle size={13} className="animate-spin" /> NEWS FEED</span><div className="placeholder-orb"><LoaderCircle size={36} className="animate-spin" /></div><h2>뉴스 불러오는 중...</h2><p>선택된 분야의 최신 뉴스를 찾고 있습니다.</p><div className="skeleton-bars"><i /><i /><i /></div></div>
          : article ? <><NewsCard article={article} analysis={analysis} analysisMode={analysisMode} analysisLoading={analysisLoading} analysisLocked={analysisLocked} onQuiz={() => { setQuizStarted(true); setTimeout(() => document.getElementById("quiz")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }} onAnother={spin} quizStarted={quizStarted} />
            {analysis && analysisMode !== "unavailable" && hackEvent?.active && <HackPanel key={article.id} coins={state.coins} event={hackEvent} actual={analysis.marketImpact}
              onPredict={(issue, direction, amount) => resolveHack(article.id, analysis.marketImpact, issue, direction, amount)}
              onRestore={() => resolveHack(article.id, analysis.marketImpact)} />}</>
          : <div className="placeholder-card glass-panel"><div className="panel-topline"><span className="tag purple-tag"><Sparkles size={13} /> YOUR NEXT STORY</span><span className="panel-index">02 / READ</span></div><div className="placeholder-graphic"><span className="graphic-card back" /><span className="graphic-card front"><BookOpen size={35} /></span><span className="graphic-glow" /></div><h2>{newsError ? "잠시 연결이 끊겼어요" : "아직 뽑은 뉴스가 없어요"}</h2><p>{newsError ? "룰렛을 다시 돌리면 새로 시도합니다." : "룰렛을 돌려 오늘의 첫 뉴스 카드를 뽑아보세요."}</p><div className="steps"><span><b>01</b> 룰렛을 돌리고</span><span><b>02</b> 뉴스를 읽고</span><span><b>03</b> 코인을 얻어요</span></div></div>}
          {article && quizStarted && analysis && !analysisLocked && !analysis.insufficient && !!analysis.quiz.question && <div id="quiz"><QuizPanel key={article.id} quiz={analysis.quiz} completed={state.completedQuizIds.includes(article.id)} wrongAttempts={state.quizAttempts[article.id] ?? 0} onWrong={(index) => recordWrongAttempt(article.id, index)} onCorrect={(index) => awardQuiz(article.id, index)} onMarket={() => goToMarket(analysis.issueId)} /></div>}
        </div></div>
        <section className="market-preview"><div className="preview-heading"><div><span className="section-kicker">MARKET SNAPSHOT</span><h2>지금의 이슈 지수</h2></div><button onClick={() => goToMarket()} className="text-button">거래소 전체 보기 <ArrowRight size={16} /></button></div><div className="preview-grid">{market.slice(0, 3).map((issue) => { const meta = ISSUE_BY_ID[issue.id]; const rate = changePercent(issue); return <button className="preview-card glass-panel" key={issue.id} onClick={() => goToMarket(issue.id)}><span className="preview-icon" style={{ color: meta.color, background: `${meta.color}17` }}>{meta.symbol}</span><span className="preview-name">{issue.name}</span><strong>{formatCoin(issue.currentPrice)}</strong><small className={rate >= 0 ? "positive" : "negative"}>{formatPercent(rate)} <ArrowUpRight size={13} /></small></button>; })}</div></section>
      </>}
      {tab === "market" && <MarketBoard market={market} state={state} selectedId={selectedIssue} onSelect={setSelectedIssue} onBuy={buy} onSell={sell} secondsToNextTick={secondsToNextTick} busy={busy} longShort={longShort} onOpenLongShort={openLongShort} onSettleLongShort={settleLongShort} />}
      {tab === "portfolio" && <Portfolio state={state} market={market} onMarket={() => goToMarket()} />}
      {tab === "history" && <NewsHistory state={state} />}
      {tab === "missions" && <DailyMissions state={state} onClaim={claimMission} onClaimAll={claimAllMissions} busy={busy} />}
      {tab === "shop" && <Shop state={state} busy={busy} onPurchase={purchaseItem} onEquip={equipItem} />}
      {tab === "happy" && <HappyDwi coins={state.coins} completedCount={state.happyTypingCount} dailyEarned={state.happyDailyEarned} spinCost={ROULETTE_COST} onEarn={earnHappyCoin} onGoHome={() => setTab("home")} busy={busy} />}
    </main>
    <footer className="site-footer"><span><BarChart3 size={16} /> NEWSPI <b>.</b></span><p>읽으면 벌고, 알면 오른다.</p><small>모든 코인과 이슈 가격은 가상이며 실제 투자와 무관합니다.</small></footer>
  </div>;
}
