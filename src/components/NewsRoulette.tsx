"use client";

import { ArrowUpRight, Coins, Dices, Heart, LoaderCircle } from "lucide-react";
import { CATEGORY_LABELS, NEWS_CATEGORIES, type NewsCategory } from "@/types";

type Props = {
  rotation: number;
  spinning: boolean;
  selectedCategory: NewsCategory | null;
  onSpin: () => void;
  disabled: boolean;
  canAfford: boolean;
  onOpenHappy: () => void;
  cost: number;
};

export function NewsRoulette({ rotation, spinning, selectedCategory, onSpin, disabled, canAfford, onOpenHappy, cost }: Props) {
  const sector = 360 / NEWS_CATEGORIES.length;
  return (
    <section className="roulette-panel glass-panel">
      <div className="panel-topline"><span className="tag neon-tag"><Dices size={13} /> NEWS ROULETTE</span><span className="panel-index">01 / DISCOVER</span></div>
      <div className="roulette-header"><h2>오늘의 뉴스,<br /><em>운에 맡겨볼까요?</em></h2><p>7개 분야 중 하나를 뽑고<br />새로운 시선을 발견하세요.</p></div>
      <div className="wheel-stage">
        <div className="wheel-halo" />
        <div className="wheel-pointer" />
        <div className="wheel" style={{ transform: `rotate(${rotation}deg)` }} aria-hidden="true">
          {NEWS_CATEGORIES.map((category, index) => {
            const angle = (index + 0.5) * sector * Math.PI / 180;
            return <span key={category} className="wheel-label" style={{ left: `${50 + 35 * Math.sin(angle)}%`, top: `${50 - 35 * Math.cos(angle)}%` }}>{CATEGORY_LABELS[category]}</span>;
          })}
          <div className="wheel-center"><span>N</span><small>NEWSPI</small></div>
        </div>
      </div>
      <div className="roulette-bottom">
        <div className="roulette-result"><span>선택된 분야</span><strong>{selectedCategory ? CATEGORY_LABELS[selectedCategory] : "어디로 향할까요?"}</strong></div>
        <button className="primary-button spin-button" onClick={onSpin} disabled={disabled || spinning || !canAfford}>
          {spinning ? <><LoaderCircle size={17} className="animate-spin" /> 뉴스 탐색 중...</> : <><Dices size={18} /> 룰렛 돌리기 <span className="spin-price"><Coins size={14} /> {cost} C</span><ArrowUpRight size={17} /></>}
        </button>
      </div>
      {!canAfford && !spinning && <div className="roulette-low-balance"><span>룰렛에 {cost} C가 필요해요.</span><button onClick={onOpenHappy}><Heart size={13} /> 행복한 뒤주에서 모으기</button></div>}
    </section>
  );
}
