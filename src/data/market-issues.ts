import type { IssueId } from "@/types";

export type IssueDefinition = {
  id: IssueId;
  name: string;
  shortName: string;
  symbol: string;
  basePrice: number;
  color: string;
  dailyChanges: number[];
};

export const ISSUE_DEFINITIONS: IssueDefinition[] = [
  { id: "AI_TECH", name: "AI 기술 지수", shortName: "AI 기술", symbol: "AI", basePrice: 142, color: "#48e6cc", dailyChanges: [0.045, -0.018, 0.032, 0.021, -0.027, 0.038, 0.011, -0.014] },
  { id: "SEMICONDUCTOR", name: "반도체 산업 지수", shortName: "반도체", symbol: "SC", basePrice: 118, color: "#a891ff", dailyChanges: [0.028, 0.034, -0.021, 0.014, -0.032, 0.029, 0.018, -0.011] },
  { id: "ECONOMY", name: "경제·금융 지수", shortName: "경제·금융", symbol: "EC", basePrice: 96, color: "#f5c968", dailyChanges: [-0.012, 0.025, 0.018, -0.008, 0.022, -0.016, 0.031, 0.009] },
  { id: "GLOBAL", name: "글로벌 이슈 지수", shortName: "글로벌", symbol: "GL", basePrice: 105, color: "#6aaeff", dailyChanges: [0.016, -0.025, 0.033, -0.011, 0.019, 0.026, -0.018, 0.015] },
  { id: "SOCIETY", name: "사회 이슈 지수", shortName: "사회 이슈", symbol: "SO", basePrice: 84, color: "#f38fae", dailyChanges: [0.012, 0.009, -0.017, 0.026, -0.008, 0.022, 0.013, -0.015] },
  { id: "CULTURE", name: "문화·콘텐츠 지수", shortName: "문화", symbol: "CU", basePrice: 110, color: "#d694f9", dailyChanges: [0.032, -0.012, 0.019, 0.027, -0.016, 0.022, -0.009, 0.031] },
  { id: "SPORTS", name: "스포츠 지수", shortName: "스포츠", symbol: "SP", basePrice: 77, color: "#80d8ff", dailyChanges: [-0.008, 0.037, 0.011, -0.022, 0.028, 0.016, -0.012, 0.024] },
];

export const ISSUE_BY_ID = Object.fromEntries(ISSUE_DEFINITIONS.map((item) => [item.id, item])) as Record<IssueId, IssueDefinition>;
