"use client";

import { ArrowRight, Coins, Heart, PenLine, Sparkles } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { HAPPY_PHRASES } from "@/data/happy-phrases";
import { formatCoin, formatNumber } from "@/lib/format";

type Props = {
  coins: number;
  completedCount: number;
  dailyEarned: number;
  spinCost: number;
  onEarn: (typedText: string) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
  onGoHome: () => void;
  busy?: boolean;
};

export function HappyDwi({ coins, completedCount, dailyEarned, spinCost, onEarn, onGoHome, busy = false }: Props) {
  const [typedText, setTypedText] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const submitting = useRef(false);
  const phrase = HAPPY_PHRASES[completedCount % HAPPY_PHRASES.length];
  const progress = Math.min(100, Math.round((typedText.length / phrase.length) * 100));
  const coinsToSpin = Math.max(0, spinCost - coins);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || busy) return;
    submitting.current = true;
    try {
      const result = await onEarn(typedText);
      setFeedback(result);
      if (result.ok) setTypedText("");
    } catch { setFeedback({ ok: false, message: "보상을 저장하지 못했습니다. 다시 시도해 주세요." }); }
    finally { submitting.current = false; }
  }

  return <div className="happy-layout">
    <div className="page-heading happy-heading">
      <div><span className="section-kicker">A SMALL WAY BACK</span><h1>행복한 뒤주<span className="title-dot">.</span></h1><p>좋은 말을 따라 적고 언제든 1 C씩 모아 보세요.</p></div>
      <div className="happy-balance"><Coins size={18} /><span>지금 내 코인</span><strong>{formatCoin(coins)}</strong></div>
    </div>
    <div className="happy-grid">
      <section className="happy-writing glass-panel">
        <div className="panel-topline"><span className="tag gold-tag"><Heart size={13} /> KIND WORDS</span><span className="panel-index">+1 C / 문장</span></div>
        <div className="happy-intro"><h2>오늘 나에게<br /><em>건네고 싶은 말</em></h2><p>문장을 정확히 따라 적을 때마다 1 C를 받습니다.<br />횟수나 보유 코인 제한 없이 계속할 수 있어요.</p></div>
        <>
          <div className="happy-quote"><span><Sparkles size={15} /> SENTENCE {String((completedCount % HAPPY_PHRASES.length) + 1).padStart(2, "0")}</span><p>{phrase}</p></div>
          <form onSubmit={submit}>
            <label className="happy-label" htmlFor="happy-typing">문장 따라 적기 <span>마침표까지 적어 주세요</span></label>
            <textarea id="happy-typing" value={typedText} onChange={(event) => { setTypedText(event.target.value); if (feedback) setFeedback(null); }} placeholder="위 문장을 여기에 적어 주세요" rows={4} maxLength={phrase.length + 30} spellCheck={false} />
            <div className="happy-progress-row"><span>입력 진행도</span><strong>{progress}%</strong></div>
            <div className="happy-progress" role="progressbar" aria-label="문장 입력 진행도" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: String(progress) + "%" }} /></div>
            <button className="primary-button happy-submit" type="submit" disabled={!typedText.trim() || busy}><PenLine size={17} /> 문장 제출하고 1 C 받기 <ArrowRight size={16} /></button>
          </form>
        </>
        {feedback && <div className={feedback.ok ? "happy-feedback success" : "happy-feedback error"} role="status">{feedback.ok ? <Coins size={18} /> : <Heart size={18} />}<span>{feedback.message}</span></div>}
      </section>
      <aside className="happy-side">
        <div className="happy-rescue glass-panel"><div className="happy-heart"><Heart size={31} fill="currentColor" /></div><span className="section-kicker">NEVER STUCK AT ZERO</span><h3>빈 뒤주에도<br />다시 채울 수 있어요.</h3><p>문장 하나를 정확히 적을 때마다 1 C. 원할 때 언제든 계속할 수 있어요.</p><div className="rescue-count"><span>다음 룰렛까지</span><strong>{coinsToSpin ? String(coinsToSpin) + " C 더 필요" : "지금 돌릴 수 있어요"}</strong></div><button onClick={onGoHome} className="outline-button">뉴스 룰렛으로 돌아가기 <ArrowRight size={16} /></button></div>
        <div className="happy-stats glass-panel"><span>MY KIND WORDS</span><div><strong>{formatNumber(completedCount)}</strong><small>완성한 문장</small></div><div><strong>{formatCoin(dailyEarned)}</strong><small>오늘 받은 코인</small></div></div>
      </aside>
    </div>
  </div>;
}
