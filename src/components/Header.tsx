"use client";

import { Coins, RotateCcw, Sparkles } from "lucide-react";
import { NewspiMark } from "@/components/NewspiMark";
import { formatCoin, formatCountdown } from "@/lib/format";

export type Tab = "home" | "market" | "portfolio" | "history" | "missions" | "shop" | "happy";

type Props = {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  coins: number;
  totalAssets: number;
  secondsToNextTick: number;
  playerTitle: string;
  onReset: () => void;
};

export function Header({ tab, onTabChange, coins, totalAssets, secondsToNextTick, playerTitle, onReset }: Props) {
  const primaryTabs: { id: Tab; label: string }[] = [
    { id: "home", label: "뉴스 룰렛" },
    { id: "market", label: "이슈 거래소" },
    { id: "portfolio", label: "내 포트폴리오" },
    { id: "shop", label: "코인 상점" },
  ];
  const secondaryTabs: { id: Tab; label: string }[] = [
    { id: "history", label: "뉴스 기록" },
    { id: "missions", label: "오늘의 미션" },
    { id: "happy", label: "행복한 뒤주" },
  ];
  const tabs = [...primaryTabs, ...secondaryTabs];
  return (
    <header className="site-header">
      <div className="header-main">
        <button className="brand" onClick={() => onTabChange("home")} aria-label="NEWSPI 홈으로 이동">
          <span className="brand-mark"><NewspiMark /></span>
          <span className="brand-word">NEWSPI<span className="brand-dot">.</span><small>뉴스피</small></span>
        </button>
        <nav className="desktop-nav" aria-label="주 메뉴">
          {primaryTabs.map((item) => <button key={item.id} className={`nav-item ${tab === item.id ? "active" : ""}`} onClick={() => onTabChange(item.id)}>{item.label}</button>)}
        </nav>
        <div className="header-wallet">
          <div className="wallet-icon"><Coins size={18} /></div>
          <div><span className="eyebrow">{playerTitle}</span><strong>{formatCoin(coins)}</strong></div>
        </div>
      </div>
      <div className="header-sub">
        <div className="market-open"><span className="live-dot" /> NEWSPI MARKET <span className="sub-divider">/</span> 다음 변동 {formatCountdown(secondsToNextTick)}</div>
        <nav className="secondary-nav" aria-label="보조 메뉴">{secondaryTabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => onTabChange(item.id)}>{item.label}</button>)}</nav>
        <div className="sub-actions"><span><Sparkles size={13} /> 총자산 {formatCoin(totalAssets)}</span><button onClick={onReset} title="저장된 게임 데이터를 초기화합니다"><RotateCcw size={13} /> 데이터 초기화</button></div>
      </div>
      <nav className="mobile-nav" aria-label="모바일 주 메뉴">
        {tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => onTabChange(item.id)}>{item.label}</button>)}
      </nav>
    </header>
  );
}
