"use client";

import { ArrowRight, Coins, Heart, PenLine, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { HAPPY_PHRASES } from "@/data/happy-phrases";
import { formatCoin, formatNumber } from "@/lib/format";
import { HAPPY_DAILY_LIMIT } from "@/lib/game";

type Props = {
  coins: number;
  completedCount: number;
  dailyEarned: number;
  spinCost: number;
  onEarn: (typedText: string) => { ok: boolean; message: string };
  onGoHome: () => void;
};

export function HappyDwi({ coins, completedCount, dailyEarned, spinCost, onEarn, onGoHome }: Props) {
  const [typedText, setTypedText] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const phrase = HAPPY_PHRASES[completedCount % HAPPY_PHRASES.length];
  const progress = Math.min(100, Math.round((typedText.length / phrase.length) * 100));
  const coinsToSpin = Math.max(0, spinCost - coins);
  const canEarn = coins < spinCost && dailyEarned < HAPPY_DAILY_LIMIT;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onEarn(typedText);
    setFeedback(result);
    if (result.ok) setTypedText("");
  }

  return <div className="happy-layout">
    <div className="page-heading happy-heading">
      <div><span className="section-kicker">A SMALL WAY BACK</span><h1>행복한 뒤주<span className="title-dot">.</span></h1><p>코인이 부족할 때 좋은 말을 적으며 다시 시작해 보세요.</p></div>
      <div className="happy-balance"><Coins size={18} /><span>지금 내 코인</span><strong>{formatCoin(coins)}</strong></div>
    </div>
    <div className="happy-grid">
      <section className="happy-writing glass-panel">
        <div className="panel-topline"><span className="tag gold-tag"><Heart size={13} /> KIND WORDS</span><span className="panel-index">+1 C / 문장</span></div>
        <div className="happy-intro"><h2>오늘 나에게<br /><em>건네고 싶은 말</em></h2><p>룰렛 코인이 부족할 때 문장을 따라 적어 보세요.<br />하루 최대 10 C를 받을 수 있습니다.</p></div>
        {canEarn ? <>
          <div className="happy-quote"><span><Sparkles size={15} /> SENTENCE {String((completedCount % HAPPY_PHRASES.length) + 1).padStart(2, "0")}</span><p>{phrase}</p></div>
          <form onSubmit={submit}>
            <label className="happy-label" htmlFor="happy-typing">문장 따라 적기 <span>마침표까지 적어 주세요</span></label>
            <textarea id="happy-typing" value={typedText} onChange={(event) => { setTypedText(event.target.value); if (feedback) setFeedback(null); }} placeholder="위 문장을 여기에 적어 주세요" rows={4} maxLength={phrase.length + 30} spellCheck={false} />
            <div className="happy-progress-row"><span>입력 진행도</span><strong>{progress}%</strong></div>
            <div className="happy-progress" role="progressbar" aria-label="문장 입력 진행도" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: String(progress) + "%" }} /></div>
            <button className="primary-button happy-submit" type="submit" disabled={!typedText.trim()}><PenLine size={17} /> 문장 제출하고 1 C 받기 <ArrowRight size={16} /></button>
          </form>
        </> : <div className="happy-closed"><Heart size={26} /><strong>{coins >= spinCost ? "행복한 뒤주는 파산 위기에 처한 백성에게만 열립니다." : "오늘 받을 수 있는 10 C를 모두 받았습니다."}</strong><p>{coins >= spinCost ? "다시 10 C 미만이 되면 열립니다." : "내일 다시 문장을 적을 수 있습니다."}</p></div>}
        {feedback && <div className={feedback.ok ? "happy-feedback success" : "happy-feedback error"} role="status">{feedback.ok ? <Coins size={18} /> : <Heart size={18} />}<span>{feedback.message}</span></div>}
      </section>
      <aside className="happy-side">
        <div className="happy-rescue glass-panel"><div className="happy-heart"><Heart size={31} fill="currentColor" /></div><span className="section-kicker">NEVER STUCK AT ZERO</span><h3>빈 뒤주에도<br />다시 채울 수 있어요.</h3><p>문장 하나를 정확히 적을 때마다 1 C. 하루 최대 10 C까지 받을 수 있어요.</p><div className="rescue-count"><span>다음 룰렛까지</span><strong>{coinsToSpin ? String(coinsToSpin) + " C 더 필요" : "지금 돌릴 수 있어요"}</strong></div><button onClick={onGoHome} className="outline-button">뉴스 룰렛으로 돌아가기 <ArrowRight size={16} /></button></div>
        <div className="happy-stats glass-panel"><span>MY KIND WORDS</span><div><strong>{formatNumber(completedCount)}</strong><small>완성한 문장</small></div><div><strong>{formatCoin(dailyEarned)} / 10 C</strong><small>오늘 받은 코인</small></div></div>
      </aside>
    </div>
  </div>;
}
