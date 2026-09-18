"use client";

import { ArrowRight, Check, CircleHelp, Coins, LockKeyhole, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import type { Quiz } from "@/types";

type Props = {
  quiz: Quiz;
  completed: boolean;
  wrongAttempts: number;
  onWrong: () => void;
  onCorrect: () => number;
  onMarket: () => void;
};

type Result = { kind: "correct" | "wrong" | "exhausted"; reward: number; selected: number } | null;

export function QuizPanel({ quiz, completed, wrongAttempts, onWrong, onCorrect, onMarket }: Props) {
  const [result, setResult] = useState<Result>(null);
  const alreadyRewarded = completed && result?.kind !== "correct";
  const exhausted = wrongAttempts >= 2 && !result;
  const locked = !!result || completed || exhausted;

  function select(index: number) {
    if (locked) return;
    if (index === quiz.answerIndex) {
      const reward = onCorrect();
      setResult({ kind: "correct", reward, selected: index });
    } else {
      onWrong();
      setResult({ kind: wrongAttempts + 1 >= 2 ? "exhausted" : "wrong", reward: 0, selected: index });
    }
  }

  const reveal = result?.kind === "correct" || result?.kind === "exhausted" || alreadyRewarded || exhausted;
  return (
    <section className="quiz-panel glass-panel card-arrive">
      <div className="panel-topline"><span className="tag gold-tag"><CircleHelp size={13} /> KNOWLEDGE QUIZ</span><span className="panel-index">03 / EARN</span></div>
      <div className="quiz-top"><div><p className="section-kicker">READ IT. KNOW IT. EARN IT.</p><h2>뉴스를 읽었다면<br /><em>답을 찾아보세요.</em></h2></div><div className="reward-chip"><Coins size={20} /><span>정답 보상</span><strong>{wrongAttempts === 0 ? "100" : wrongAttempts === 1 ? "50" : "0"} C</strong></div></div>
      <div className="quiz-question"><span>QUESTION 01</span><h3>{quiz.question}</h3></div>
      <div className="quiz-choices">
        {quiz.choices.map((choice, index) => {
          const correct = reveal && index === quiz.answerIndex;
          const wrong = result && result.selected === index && index !== quiz.answerIndex;
          return <button key={`${index}-${choice}`} className={`quiz-choice ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`} onClick={() => select(index)} disabled={locked}>
            <span className="choice-letter">{String.fromCharCode(65 + index)}</span><span>{choice}</span>{correct && <Check size={17} />}{wrong && <X size={17} />}
          </button>;
        })}
      </div>
      {result?.kind === "wrong" && <div className="quiz-feedback retry"><X size={18} /><div><strong>아쉽지만 한 번 더!</strong><p>기사 내용을 다시 살펴보세요. 두 번째 정답은 50코인입니다.</p></div><button onClick={() => setResult(null)}><RotateCcw size={15} /> 다시 도전</button></div>}
      {result?.kind === "correct" && <div className="quiz-feedback success"><div className="reward-spark"><Coins size={24} /></div><div><strong>정답입니다! <span className="earned-coins">+{result.reward} C</span></strong><p>{quiz.explanation}</p></div></div>}
      {(result?.kind === "exhausted" || exhausted) && <div className="quiz-feedback ended"><LockKeyhole size={19} /><div><strong>이번 퀴즈의 도전이 끝났습니다.</strong><p>{quiz.explanation}</p></div></div>}
      {alreadyRewarded && <div className="quiz-feedback ended"><LockKeyhole size={19} /><div><strong>이미 보상을 받은 뉴스입니다.</strong><p>{quiz.explanation}</p></div></div>}
      {reveal && <button className="primary-button quiz-market-button" onClick={onMarket}>관련 이슈 거래소 보기 <ArrowRight size={17} /></button>}
      {!locked && <p className="quiz-hint">첫 번째 정답 100 C · 두 번째 정답 50 C · 뉴스당 보상 1회</p>}
    </section>
  );
}
