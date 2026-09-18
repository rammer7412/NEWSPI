"use client";

import { ArrowRight, Coins, Heart, PenLine, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { HAPPY_PHRASES } from "@/data/happy-phrases";
import { formatCoin, formatNumber } from "@/lib/format";

type Props = {
  coins: number;
  completedCount: number;
  spinCost: number;
  onEarn: (typedText: string) => { ok: boolean; message: string };
  onGoHome: () => void;
};

export function HappyDwi({ coins, completedCount, spinCost, onEarn, onGoHome }: Props) {
  const [typedText, setTypedText] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const phrase = HAPPY_PHRASES[completedCount % HAPPY_PHRASES.length];
  const progress = Math.min(100, Math.round((typedText.length / phrase.length) * 100));
  const coinsToSpin = Math.max(0, spinCost - coins);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onEarn(typedText);
    setFeedback(result);
    if (result.ok) setTypedText("");
  }

  return <div className="happy-layout">
    <div className="page-heading happy-heading"><div><span className="section-kicker">A SMALL WAY BACK</span><h1>행복한 뒤주<span className="title-dot">.</span></h1><p>잔액이 0 C여도 괜찮아요. 나에게 좋은 말을 적으며 다시 시작할 수 있어요.</p></div><div className="happy-balance"><Coins size={18} /><span>지금 내 코인</span><strong>{formatCoin(coins)}</strong></div></div>
    <div className="happy-grid">
      <section className="happy-writing glass-panel"><div className="panel-topline"><span className="tag gold-tag"><Heart size={13} /> KIND WORDS</span><span className="panel-index">+1 C / 문장</span></div><div className="happy-intro"><h2>오늘 나에게<br /><em>건네고 싶은 말</em></h2><p>아래 문장을 천천히 따라 적고 제출해 보세요.<br />정확하게 적으면 1 C를 받습니다.</p></div><div className="happy-quote"><span><Sparkles size={15} /> SENTENCE {String((completedCount % HAPPY_PHRASES.length) + 1).padStart(2, "0")}</span><p>{phrase}</p></div><form onSubmit={submit}><label className="happy-label" htmlFor="happy-typing">문장 따라 적기 <span>마침표까지 적어 주세요</span></label><textarea id="happy-typing" value={typedText} onChange={(event) => { setTypedText(event.target.value); if (feedback) setFeedback(null); }} placeholder="위 문장을 여기에 적어 주세요" rows={4} maxLength={phrase.length + 30} spellCheck={false} /><div className="happy-progress-row"><span>입력 진행도</span><strong>{progress}%</strong></div><div className="happy-progress" role="progressbar" aria-label="문장 입력 진행도" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><button className="primary-button happy-submit" type="submit" disabled={!typedText.trim()}><PenLine size={17} /> 문장 제출하고 1 C 받기 <ArrowRight size={16} /></button></form>{feedback && <div className={`happy-feedback ${feedback.ok ? "success" : "error"}`} role="status">{feedback.ok ? <Coins size={18} /> : <Heart size={18} />}<span>{feedback.message}</span></div>}</section>
      <aside className="happy-side"><div className="happy-rescue glass-panel"><div className="happy-heart"><Heart size={31} fill="currentColor" /></div><span className="section-kicker">NEVER STUCK AT ZERO</span><h3>빈 뒤주에도<br />다시 채울 수 있어요.</h3><p>문장 하나를 적을 때마다 1 C. 준비된 문장을 모두 적어도 다시 처음부터 이어집니다.</p><div className="rescue-count"><span>다음 룰렛까지</span><strong>{coinsToSpin ? `${coinsToSpin} C 더 필요` : "지금 돌릴 수 있어요"}</strong></div><button onClick={onGoHome} className="outline-button">뉴스 룰렛으로 돌아가기 <ArrowRight size={16} /></button></div><div className="happy-stats glass-panel"><span>MY KIND WORDS</span><div><strong>{formatNumber(completedCount)}</strong><small>완성한 문장</small></div><div><strong>{formatCoin(completedCount)}</strong><small>뒤주에서 번 코인</small></div></div></aside>
    </div>
  </div>;
}
