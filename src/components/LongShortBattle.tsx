"use client";

import { ArrowDownRight, ArrowUpRight, Clock3, Coins, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatCoin, formatPercent } from "@/lib/format";
import type { IssueId, LongShortBet, LongShortDirection, LongShortSnapshot, MarketIssue } from "@/types";

type StakeChoice = "10" | "25" | "50" | "MAX";
type Props = {
  market: MarketIssue[];
  selectedId: IssueId;
  onSelect: (id: IssueId) => void;
  coins: number;
  snapshot: LongShortSnapshot;
  onOpen: (id: IssueId, direction: LongShortDirection, stake: StakeChoice) => Promise<{ ok: boolean; message: string }>;
  onSettle: () => Promise<LongShortBet | null>;
  busy?: boolean;
  enabled: boolean;
};

const choices: StakeChoice[] = ["10", "25", "50", "MAX"];

export function LongShortBattle({ market, selectedId, onSelect, coins, snapshot, onOpen, onSettle,
  busy = false, enabled }: Props) {
  const [direction, setDirection] = useState<LongShortDirection>("LONG");
  const [choice, setChoice] = useState<StakeChoice>("10");
  const [now, setNow] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<LongShortBet | null>(null);
  const settling = useRef(false);
  const settleRetryAt = useRef(0);
  const shown = useRef<string | null>(null);
  const active = snapshot.active;
  const selected = market.find((item) => item.id === selectedId) ?? market[0];
  const activeIssue = active ? market.find((item) => item.id === active.assetId) : null;
  const currentPrice = activeIssue?.currentPrice ?? active?.entryPrice ?? 0;
  const offset = snapshot.serverNow && snapshot.receivedAt ? snapshot.serverNow - snapshot.receivedAt : 0;
  const secondsLeft = active ? (now ? Math.max(0, Math.ceil((active.expiresAt - now - offset) / 1000)) : 60) : 0;
  const stake = choice === "MAX" ? Math.floor(coins) : Number(choice);
  const estimatedPayout = Math.floor(stake * 1.8);
  const difference = active ? currentPrice - active.entryPrice : 0;
  const differencePercent = active && active.entryPrice ? difference / active.entryPrice * 100 : 0;
  const liveStatus = !active ? "" : difference === 0 ? "무승부 구간" :
    (difference > 0) === (active.direction === "LONG") ? "현재 예측 적중" : "현재 예측 반대";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const settled = snapshot.settledBet;
    if (settled && shown.current !== settled.id) {
      shown.current = settled.id;
      setResult(settled);
    }
  }, [snapshot.settledBet]);

  useEffect(() => {
    if (!active || secondsLeft > 0 || settling.current || now < settleRetryAt.current) return;
    settling.current = true;
    void onSettle().then((bet) => {
      if (bet && shown.current !== bet.id) {
        shown.current = bet.id;
        setResult(bet);
      }
    }).catch(() => setMessage("정산 연결을 다시 시도하고 있습니다.")).finally(() => {
      settleRetryAt.current = Date.now() + 1500;
      settling.current = false;
    });
  }, [active, secondsLeft, now, onSettle]);

  async function open() {
    if (pending || busy || active || stake < 1 || stake > coins) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await onOpen(selectedId, direction, choice);
      if (!response.ok) setMessage(response.message);
    } catch {
      setMessage("베팅을 시작하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return <section className="long-short glass-panel" aria-labelledby="long-short-title">
    <div className="long-short-heading"><div><span className="section-kicker">60 SECOND PREDICTION</span><h2 id="long-short-title">롱·숏 배틀<span className="title-dot">.</span></h2><p>이슈 지수의 60초 뒤 방향을 예측하세요.</p></div><span className="coin-mini"><Coins size={15} /> {formatCoin(coins)}</span></div>
    {!enabled ? <p className="long-short-note">롱·숏 배틀은 Supabase 연결 후 이용할 수 있습니다.</p> :
      active ? <div className="long-short-active">
        <div className="long-short-active-top"><span className={active.direction === "LONG" ? "long-short-direction long" : "long-short-direction short"}>{active.direction === "LONG" ? <ArrowUpRight size={19} /> : <ArrowDownRight size={19} />}{active.direction}</span><span>{activeIssue?.name ?? active.assetId} · {formatCoin(active.stake)} 베팅</span></div>
        <div className="long-short-timer"><Clock3 size={24} /><strong className={secondsLeft <= 5 ? "countdown-urgent" : ""}>{String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}</strong><small>{secondsLeft === 0 ? "서버 정산 중..." : "남은 시간"}</small></div>
        <div className="long-short-prices"><div><span>진입 가격</span><strong>{formatCoin(active.entryPrice)}</strong></div><div><span>현재 가격</span><strong>{formatCoin(currentPrice)}</strong></div><div><span>가격 차이</span><strong className={difference >= 0 ? "positive" : "negative"}>{difference >= 0 ? "+" : ""}{formatCoin(difference)} <small>({formatPercent(differencePercent)})</small></strong></div></div>
        <p className={liveStatus === "현재 예측 적중" ? "long-short-live positive" : liveStatus === "현재 예측 반대" ? "long-short-live negative" : "long-short-live"}>{liveStatus} · 종료 시 서버 가격으로 확정됩니다.</p>
      </div> : <div className="long-short-form">
        <label htmlFor="long-short-issue">예측할 이슈 지수</label>
        <select id="long-short-issue" value={selectedId} onChange={(event) => onSelect(event.target.value as IssueId)}>{market.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <div className="long-short-selected"><span>{selected.name}</span><strong>{formatCoin(selected.currentPrice)}</strong></div>
        <div className="long-short-directions"><button type="button" className={direction === "LONG" ? "long-selected" : ""} onClick={() => setDirection("LONG")}><ArrowUpRight size={19} /> LONG <small>상승</small></button><button type="button" className={direction === "SHORT" ? "short-selected" : ""} onClick={() => setDirection("SHORT")}><ArrowDownRight size={19} /> SHORT <small>하락</small></button></div>
        <div className="long-short-stakes">{choices.map((item) => { const amount = item === "MAX" ? Math.floor(coins) : Number(item); return <button key={item} type="button" className={choice === item ? "selected" : ""} disabled={amount < 1 || amount > coins} onClick={() => setChoice(item)}>{item === "MAX" ? "MAX" : item + " C"}</button>; })}</div>
        <div className="long-short-estimate"><span>베팅 금액 <strong>{formatCoin(stake)}</strong></span><span>승리 시 예상 지급 <strong>{formatCoin(estimatedPayout)}</strong></span></div>
        <button type="button" className="primary-button long-short-start" disabled={pending || busy || stake < 1 || stake > coins} onClick={() => void open()}>{pending ? "시작 중..." : "60초 예측 시작"}</button>
      </div>}
    {message && <p className="trade-message bad" role="alert">{message}</p>}
    <div className="long-short-recent"><h3>최근 결과 <small>최대 10개</small></h3>{snapshot.recent.length ? snapshot.recent.map((bet) => <div key={bet.id}><span>{market.find((item) => item.id === bet.assetId)?.name ?? bet.assetId} · {bet.direction}</span><strong className={bet.status === "WON" ? "positive" : bet.status === "LOST" ? "negative" : ""}>{bet.status === "WON" ? "승리" : bet.status === "LOST" ? "패배" : "무승부"} {bet.payout === null ? "" : formatCoin(bet.payout - bet.stake)}</strong></div>) : <p>아직 완료한 배틀이 없습니다.</p>}</div>
    <p className="long-short-note">게임용 가상 코인이며 실제 투자와 무관합니다.</p>
    {result && <div className="long-short-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResult(null); }}><div className="long-short-modal glass-panel" role="dialog" aria-modal="true" aria-labelledby="long-short-result-title"><button className="long-short-close" aria-label="결과 닫기" onClick={() => setResult(null)}><X size={20} /></button><Trophy size={35} className={result.status === "WON" ? "positive" : result.status === "LOST" ? "negative" : ""} /><span className="section-kicker">BATTLE RESULT</span><h2 id="long-short-result-title">{result.status === "WON" ? "예측 승리" : result.status === "LOST" ? "예측 패배" : "무승부"}</h2><p>{result.direction} · {market.find((item) => item.id === result.assetId)?.name ?? result.assetId}</p><div><span>진입 가격</span><strong>{formatCoin(result.entryPrice)}</strong></div><div><span>종료 가격</span><strong>{formatCoin(result.exitPrice ?? result.entryPrice)}</strong></div><div><span>지급 코인</span><strong>{formatCoin(result.payout ?? 0)}</strong></div><button className="primary-button" onClick={() => setResult(null)}>확인</button></div></div>}
  </section>;
}
