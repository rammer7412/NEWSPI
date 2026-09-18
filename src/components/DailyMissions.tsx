"use client";

import { Check, Coins, Flag, Gift, Newspaper, Shield, Trophy } from "lucide-react";
import { MISSION_REWARD, missionProgress } from "@/lib/game";
import { MISSION_IDS, type MissionId, type UserState } from "@/types";

const MISSIONS: Record<MissionId, { title: string; task: string; target: number; Icon: typeof Newspaper }> = {
  explorer: { title: "뉴스 탐험가", task: "뉴스 3개 읽기", target: 3, Icon: Newspaper },
  streak: { title: "상식 연승", task: "퀴즈 2개 연속 정답", target: 2, Icon: Trophy },
  hacker: { title: "해커의 역습", task: "해킹 이벤트에서 1회 예측 완료", target: 1, Icon: Shield },
};

export function DailyMissions({ state, onClaim, onClaimAll }: {
  state: UserState;
  onClaim: (id: MissionId) => boolean;
  onClaimAll: () => boolean;
}) {
  const daily = state.dailyMission;
  const readyForAll = MISSION_IDS.every((id) => daily.claimed[id]);
  return <div className="mission-layout">
    <div className="page-heading"><div><span className="section-kicker">DAILY QUESTS · {daily.date}</span><h1>오늘의 미션<span className="title-dot">.</span></h1><p>진행도를 채운 뒤 직접 보상을 받아 주세요. 날짜가 바뀌면 새 미션이 시작됩니다.</p></div><div className="happy-balance"><Coins size={18} /><span>미션당 보상</span><strong>{MISSION_REWARD} C</strong></div></div>
    <div className="mission-grid">{MISSION_IDS.map((id) => {
      const mission = MISSIONS[id];
      const progress = daily.claimed[id] ? mission.target : missionProgress(daily, id);
      const ready = progress >= mission.target;
      return <section className="mission-card glass-panel" key={id}>
        <div className="mission-icon"><mission.Icon size={23} /></div>
        <span className="section-kicker">TODAY&apos;S MISSION</span><h2>{mission.title}</h2><p>{mission.task}</p>
        <div className="mission-progress-line"><span>진행도</span><strong>{progress} / {mission.target}</strong></div>
        <div className="happy-progress" role="progressbar" aria-label={`${mission.title} 진행도`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={mission.target}><span style={{ width: `${progress / mission.target * 100}%` }} /></div>
        <button className="primary-button mission-claim" onClick={() => onClaim(id)} disabled={!ready || daily.claimed[id]}>{daily.claimed[id] ? <><Check size={16} /> 보상 수령 완료</> : ready ? <><Gift size={16} /> 보상 받기 · {MISSION_REWARD} C</> : <><Flag size={16} /> 진행 중</>}</button>
      </section>;
    })}</div>
    <section className="mission-all glass-panel"><div><span className="section-kicker">COMPLETE ALL</span><h2>오늘의 모든 미션 완료</h2><p>세 미션의 보상을 모두 수령하면 추가 {MISSION_REWARD} C를 받을 수 있습니다.</p></div><button className="primary-button" onClick={onClaimAll} disabled={!readyForAll || daily.allClaimed}>{daily.allClaimed ? "전체 보상 수령 완료" : `추가 보상 받기 · ${MISSION_REWARD} C`}</button></section>
  </div>;
}
