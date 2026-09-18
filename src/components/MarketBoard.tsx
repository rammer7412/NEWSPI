"use client";

import { ArrowDownRight, ArrowUpRight, Coins, Minus, Plus, Timer, TrendingUp } from "lucide-react";
import { useRef, useState } from "react";
import { LongShortBattle } from "@/components/LongShortBattle";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ISSUE_BY_ID } from "@/data/market-issues";
import { formatCoin, formatCountdown, formatNumber, formatPercent } from "@/lib/format";
import { changePercent } from "@/lib/market";
import type { IssueId, LongShortBet, LongShortDirection, LongShortSnapshot, MarketIssue, UserState } from "@/types";

function Sparkline({ values, color, id, large = false }: { values: number[]; color: string; id: string; large?: boolean }) {
  const recent = values.slice(large ? -18 : -9);
  const minimum = Math.min(...recent) * 0.97;
  const maximum = Math.max(...recent) * 1.03;
  const spread = Math.max(1, maximum - minimum);
  const points = recent.map((value, index) => `${(index / Math.max(1, recent.length - 1)) * 300},${85 - ((value - minimum) / spread) * 65}`).join(" ");
  const fillPoints = `0,100 ${points} 300,100`;
  return <svg className={large ? "sparkline large" : "sparkline"} viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="가격 추이 그래프">
    <defs><linearGradient id={`chart-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".27" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <polygon points={fillPoints} fill={`url(#chart-${id})`} /><polyline points={points} fill="none" stroke={color} strokeWidth={large ? "2.5" : "3"} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

type Props = {
  market: MarketIssue[];
  state: UserState;
  selectedId: IssueId;
  onSelect: (id: IssueId) => void;
  onBuy: (id: IssueId, quantity: number) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
  onSell: (id: IssueId, quantity: number) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
  secondsToNextTick: number;
  busy?: boolean;
  longShort: LongShortSnapshot;
  onOpenLongShort: (id: IssueId, direction: LongShortDirection, stake: "10" | "25" | "50" | "MAX") => Promise<{ ok: boolean; message: string }>;
  onSettleLongShort: () => Promise<LongShortBet | null>;
};

export function MarketBoard({ market, state, selectedId, onSelect, onBuy, onSell, secondsToNextTick,
  busy = false, longShort, onOpenLongShort, onSettleLongShort }: Props) {
  const [quantity, setQuantity] = useState("1");
  const [feedback, setFeedback] = useState<{ id: IssueId; ok: boolean; message: string } | null>(null);
  const tradeLocked = useRef(false);
  const issue = market.find((item) => item.id === selectedId) ?? market[0];
  const definition = ISSUE_BY_ID[issue.id];
  const holding = state.holdings[issue.id];
  const change = changePercent(issue);
  const evaluation = holding.quantity * issue.currentPrice;
  const pnl = evaluation - holding.quantity * holding.averagePrice;
  const returnPercent = holding.quantity && holding.averagePrice ? ((issue.currentPrice - holding.averagePrice) / holding.averagePrice) * 100 : 0;

  async function trade(kind: "buy" | "sell") {
    if (tradeLocked.current || busy) return;
    tradeLocked.current = true;
    const amount = Number(quantity);
    try {
      const result = await (kind === "buy" ? onBuy(issue.id, amount) : onSell(issue.id, amount));
      setFeedback({ id: issue.id, ...result });
    } catch {
      setFeedback({ id: issue.id, ok: false, message: "거래를 저장하지 못했습니다. 다시 시도해 주세요." });
    } finally {
      tradeLocked.current = false;
    }
  }

  return <div className="market-layout">
    <div className="page-heading"><div><span className="section-kicker">THE NEWSPI EXCHANGE</span><h1>이슈 거래소<span className="title-dot">.</span></h1><p>뉴스의 큰 흐름에 가상 코인을 투자해 보세요.</p></div><div className="day-box"><span><Timer size={16} /> NEXT MARKET TICK</span><strong>{formatCountdown(secondsToNextTick)}</strong><small>1분마다 가상 가격 변동</small></div></div>
    <div className="market-grid">
      <div className="issue-list glass-panel"><div className="list-header"><span>MARKET INDEX</span><small>7개 가상 이슈</small></div>{market.map((item) => {
        const meta = ISSUE_BY_ID[item.id];
        const rate = changePercent(item);
        return <button key={item.id} className={`issue-row ${selectedId === item.id ? "selected" : ""}`} onClick={() => { onSelect(item.id); setFeedback(null); }}><span className="issue-avatar" style={{ color: meta.color, background: `${meta.color}17` }}>{meta.symbol}</span><span className="issue-name"><strong>{meta.shortName}</strong><small>{item.name}</small></span><Sparkline values={item.priceHistory} color={meta.color} id={`mini-${item.id}`} /><span className="issue-numbers"><strong>{formatNumber(item.currentPrice)} C</strong><small className={rate >= 0 ? "positive" : "negative"}>{formatPercent(rate)}</small></span></button>;
      })}</div>
      <div className="market-detail">
        <div className="detail-chart glass-panel"><div className="detail-head"><div><span className="tag neon-tag"><TrendingUp size={13} /> LIVE SIMULATION</span><h2>{issue.name}</h2><p>{definition.symbol} · 가상 이슈 지수</p></div><span className="detail-symbol" style={{ color: definition.color, background: `${definition.color}18` }}>{definition.symbol}</span></div><div className="price-line"><strong key={`${issue.id}-${issue.currentPrice}`} className="price-flash">{formatCoin(issue.currentPrice)}</strong><span className={`change-pill ${change >= 0 ? "up" : "down"}`}>{change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{formatPercent(change)}</span></div><div className="chart-area"><div className="chart-guides"><span>{formatNumber(Math.max(...issue.priceHistory))}</span><span>{formatNumber(Math.min(...issue.priceHistory))}</span></div><Sparkline values={issue.priceHistory} color={definition.color} id={`main-${issue.id}`} large /></div><div className="chart-footer"><span>지난 가격</span><span>가격 변동 {state.marketTickCount}회</span></div></div>
        <div className="trade-card glass-panel"><div className="trade-title"><div><span className="section-kicker">TRADE THIS ISSUE</span><h3>가상 이슈 거래</h3></div><span className="coin-mini"><Coins size={15} /> {formatCoin(state.coins)}</span></div><div className="trade-stats"><div><span>보유 수량</span><strong>{formatNumber(holding.quantity)}주</strong></div><div><span>평균 매수가</span><strong>{formatCoin(holding.averagePrice)}</strong></div><div><span>평가 금액</span><strong>{formatCoin(evaluation)}</strong></div><div><span>평가 손익</span><strong className={pnl >= 0 ? "positive" : "negative"}>{pnl >= 0 ? "+" : ""}{formatCoin(pnl)} <small>({formatPercent(returnPercent)})</small></strong></div></div><label htmlFor="trade-quantity" className="quantity-label">거래 수량 <span>정수 단위로 입력</span></label><div className="quantity-input"><button aria-label="수량 줄이기" onClick={() => setQuantity(String(Math.max(1, Number(quantity || 1) - 1)))}><Minus size={16} /></button><input id="trade-quantity" type="number" min="1" step="1" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><button aria-label="수량 늘리기" onClick={() => setQuantity(String(Math.max(0, Number(quantity || 0)) + 1))}><Plus size={16} /></button></div><div className="trade-buttons"><button className="buy-button" disabled={busy} onClick={() => trade("buy")}>매수 <ArrowUpRight size={16} /></button><button className="sell-button" disabled={busy} onClick={() => trade("sell")}>매도 <ArrowDownRight size={16} /></button></div>{feedback?.id === issue.id && <p className={`trade-message ${feedback.ok ? "good" : "bad"}`} role="status">{feedback.message}</p>}</div>
      </div>
    </div>
    <LongShortBattle market={market} selectedId={selectedId} onSelect={onSelect} coins={state.coins}
      snapshot={longShort} onOpen={onOpenLongShort} onSettle={onSettleLongShort}
      busy={busy} enabled={isSupabaseConfigured} />
    <p className="market-disclaimer">모든 코인과 가격은 게임용 가상 데이터입니다. 실제 금융상품이나 투자 조언이 아닙니다.</p>
  </div>;
}
