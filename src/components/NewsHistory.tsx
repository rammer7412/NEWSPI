"use client";

import { BookOpen, ExternalLink, History, Target } from "lucide-react";
import { useState } from "react";
import { formatCoin } from "@/lib/format";
import { CATEGORY_LABELS, type NewsActivity, type NewsCategory, type UserState } from "@/types";

function readTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function NewsHistory({ state }: { state: UserState }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const history = state.newsHistory;
  const answered = history.filter((item) => item.quizAnswered);
  const predicted = history.filter((item) => item.prediction);
  const exact = predicted.filter((item) => item.prediction?.result === "EXACT").length;
  const categories = history.reduce((counts, item) => {
    counts[item.category] += 1;
    return counts;
  }, Object.fromEntries(Object.keys(CATEGORY_LABELS).map((id) => [id, 0])) as Record<NewsCategory, number>);
  const favorite = history.length ? (Object.entries(categories).sort((a, b) => b[1] - a[1])[0][0] as NewsCategory) : null;
  const stats = [
    ["읽은 뉴스", `${history.length}개`],
    ["퀴즈 정답률", answered.length ? `${Math.round(answered.filter((item) => item.quizCorrect).length / answered.length * 100)}%` : "—"],
    ["현재 연속 정답", `${state.quizCurrentStreak}회`],
    ["가장 많이 읽은 분야", favorite ? CATEGORY_LABELS[favorite] : "—"],
    ["해킹 예측 참여", `${predicted.length}회`],
    ["예측 완전 일치율", predicted.length ? `${Math.round(exact / predicted.length * 100)}%` : "—"],
    ["뉴스·예측 코인 순수익", formatCoin(state.totalNewsCoinsEarned)],
  ];

  return <div className="history-layout">
    <div className="page-heading"><div><span className="section-kicker">YOUR NEWS JOURNEY</span><h1>뉴스 기록<span className="title-dot">.</span></h1><p>최근 100개 기사와 퀴즈·예측 결과를 다시 살펴보세요.</p></div></div>
    <div className="history-stats">{stats.map(([label, value]) => <div className="glass-panel history-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <section className="history-list glass-panel"><div className="list-header"><span><History size={15} /> ACTIVITY LOG</span><small>최근 기록 {history.length}개</small></div>
      {!history.length && <div className="empty-holdings"><BookOpen size={30} /><strong>아직 읽은 뉴스가 없어요.</strong><p>룰렛에서 첫 뉴스를 뽑아보세요.</p></div>}
      {[...history].reverse().map((item: NewsActivity) => <article className="history-item" key={item.articleId}>
        <button className="history-item-head" onClick={() => setOpenId(openId === item.articleId ? null : item.articleId)} aria-expanded={openId === item.articleId}>
          <span className="history-badges"><span className="category-badge">{CATEGORY_LABELS[item.category]}</span><span className={item.isLive ? "source-badge live" : "source-badge demo"}>{item.isLive ? "LIVE" : "DEMO"}</span></span>
          <strong>{item.title}</strong><small>{item.source} · {readTime(item.viewedAt)}</small>
          <span className="history-outcomes"><span>{!item.quizAnswered ? "퀴즈 미참여" : item.quizCorrect ? item.quizReward ? `퀴즈 정답 +${item.quizReward} C` : "퀴즈 정답 · 이전 기록" : "퀴즈 오답"}</span>{item.hackEvent && <span>{item.prediction ? `예측 ${item.prediction.result === "EXACT" ? "완전 일치" : item.prediction.result === "DIRECTION_ONLY" ? "방향 일치" : "해석 차이"} · ${item.prediction.profit >= 0 ? "+" : ""}${formatCoin(item.prediction.profit)}` : "해킹 이벤트"}</span>}</span>
        </button>
        {openId === item.articleId && <div className="history-detail">
          <span className="section-kicker"><Target size={13} /> 저장된 분석</span>
          {state.hackEvents[item.articleId]?.active && !state.hackEvents[item.articleId]?.resolved
            ? <p>해킹 이벤트 예측이 끝나면 분석이 공개됩니다.</p>
            : <>{item.summary.length ? <ol>{item.summary.map((line, index) => <li key={index}>{line}</li>)}</ol> : <p>저장된 요약이 없습니다.</p>}
              {item.importance && <p><strong>왜 중요한가</strong> {item.importance}</p>}</>}
          <a href={item.originalLink} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> {item.isLive ? "원문 보기" : "주제 참고 사이트"}</a>
        </div>}
      </article>)}
    </section>
  </div>;
}
