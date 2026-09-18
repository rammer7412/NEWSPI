"use client";

import { AlertTriangle, Coins, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { ISSUE_DEFINITIONS } from "@/data/market-issues";
import { BET_AMOUNTS } from "@/lib/game";
import { formatCoin } from "@/lib/format";
import type { HackEventState, IssueId, MarketDirection, MarketImpact } from "@/types";

type ActionResult = { ok: boolean; message: string };
type Props = {
  coins: number;
  event: HackEventState;
  actual: MarketImpact;
  onPredict: (issue: IssueId, direction: MarketDirection, amount: number) => ActionResult | Promise<ActionResult>;
  onRestore: () => ActionResult | Promise<ActionResult>;
};

const DIRECTION_OPTIONS: { value: MarketDirection; label: string }[] = [
  { value: "UP", label: "상승" }, { value: "NEUTRAL", label: "중립" }, { value: "DOWN", label: "하락" },
];
const directionLabel = (value: MarketDirection) => DIRECTION_OPTIONS.find((item) => item.value === value)?.label ?? "중립";

export function HackPanel({ coins, event, actual, onPredict, onRestore }: Props) {
  const [issue, setIssue] = useState<IssueId | null>(null);
  const [direction, setDirection] = useState<MarketDirection | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [feedback, setFeedback] = useState("");
  const locked = useRef(false);

  async function submit() {
    if (locked.current || !issue || !direction || amount > coins) return;
    locked.current = true;
    try {
      const result = await onPredict(issue, direction, amount);
      if (!result.ok) { locked.current = false; setFeedback(result.message); }
    } catch { locked.current = false; setFeedback("예측을 저장하지 못했습니다. 다시 시도해 주세요."); }
  }

  async function restore() {
    if (locked.current || coins >= 10) return;
    locked.current = true;
    try {
      const result = await onRestore();
      if (!result.ok) { locked.current = false; setFeedback(result.message); }
    } catch { locked.current = false; setFeedback("분석을 복구하지 못했습니다. 다시 시도해 주세요."); }
  }

  if (event.resolved) {
    const prediction = event.prediction;
    const resultText = !prediction ? "베팅 없이 분석을 복구했습니다." : prediction.result === "EXACT"
      ? "AI 분석과 같은 이슈와 방향을 예측했습니다."
      : prediction.result === "DIRECTION_ONLY" ? "AI 분석과 같은 방향을 예측했습니다."
      : `당신은 ${directionLabel(prediction.selectedDirection)}을 예상했지만 AI 분석은 ${directionLabel(actual.direction)}으로 평가했습니다. 시장의 해석은 달라질 수 있습니다.`;
    return <div className="hack-result glass-panel" role="status"><ShieldCheck size={20} /><div><strong>AI 분석 복구 완료</strong><p>{resultText}</p>{prediction && <small>베팅 {formatCoin(prediction.betAmount)} · 손익 {prediction.profit >= 0 ? "+" : ""}{formatCoin(prediction.profit)}</small>}</div></div>;
  }

  return <section className="hack-panel glass-panel" aria-label="AI 분석 시스템 해킹 이벤트">
    <div className="hack-alert"><span className="hack-light" /><AlertTriangle size={20} /><strong>AI 분석 시스템 침입 감지</strong></div>
    <p className="hack-copy">분석 데이터가 암호화되었습니다.<br />시장 반응이 공개되기 전에 직접 예측하고 코인을 베팅하세요.</p>
    <p className="hack-disclaimer">※ 실제 해킹이 아닌 NEWSPI의 게임 내 이벤트입니다.</p>
    <div className="hack-block"><strong>1. 영향을 받을 이슈 지수</strong><div className="hack-issues">{ISSUE_DEFINITIONS.map((item) => <button key={item.id} type="button" className={issue === item.id ? "selected" : ""} onClick={() => setIssue(item.id)}>{item.shortName}</button>)}</div></div>
    <div className="hack-block"><strong>2. 영향 방향</strong><div className="hack-options">{DIRECTION_OPTIONS.map((item) => <button key={item.value} type="button" className={direction === item.value ? "selected" : ""} onClick={() => setDirection(item.value)}>{item.label}</button>)}</div></div>
    <div className="hack-block"><strong>3. 베팅 금액 <span>보유 {formatCoin(coins)}</span></strong><div className="hack-options">{BET_AMOUNTS.map((value) => <button key={value} type="button" className={amount === value ? "selected" : ""} disabled={value > coins} onClick={() => setAmount(value)}>{value} C</button>)}</div></div>
    {coins < 10 ? <button className="primary-button hack-submit" onClick={restore}><LockKeyhole size={16} /> 베팅 없이 분석 복구하기</button>
      : <button className="primary-button hack-submit" onClick={submit} disabled={!issue || !direction || amount > coins}><Coins size={16} /> 예측 확정하고 분석 복구하기</button>}
    {feedback && <p className="inline-alert" role="status">{feedback}</p>}
  </section>;
}
