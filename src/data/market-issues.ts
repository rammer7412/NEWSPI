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
  { id: "AI_TECH", name: "AI 기술 지수", shortName: "AI 기술", symbol: "AI", basePrice: 620, color: "#48e6cc", dailyChanges: [0.072, -0.041, 0.058, 0.035, -0.049, 0.064, 0.028, -0.033] },
  { id: "SEMICONDUCTOR", name: "반도체 산업 지수", shortName: "반도체", symbol: "SC", basePrice: 1480, color: "#a891ff", dailyChanges: [0.055, 0.068, -0.047, 0.032, -0.061, 0.052, 0.039, -0.028] },
  { id: "ECONOMY", name: "경제·금융 지수", shortName: "경제·금융", symbol: "EC", basePrice: 180, color: "#f5c968", dailyChanges: [-0.036, 0.052, 0.041, -0.027, 0.046, -0.039, 0.061, 0.024] },
  { id: "GLOBAL", name: "글로벌 이슈 지수", shortName: "글로벌", symbol: "GL", basePrice: 360, color: "#6aaeff", dailyChanges: [0.038, -0.054, 0.066, -0.031, 0.044, 0.057, -0.043, 0.035] },
  { id: "SOCIETY", name: "사회 이슈 지수", shortName: "사회 이슈", symbol: "SO", basePrice: 28, color: "#f38fae", dailyChanges: [0.031, 0.024, -0.042, 0.059, -0.025, 0.048, 0.034, -0.037] },
  { id: "CULTURE", name: "문화·콘텐츠 지수", shortName: "문화", symbol: "CU", basePrice: 72, color: "#d694f9", dailyChanges: [0.063, -0.034, 0.045, 0.056, -0.041, 0.049, -0.026, 0.062] },
  { id: "SPORTS", name: "스포츠 지수", shortName: "스포츠", symbol: "SP", basePrice: 12, color: "#80d8ff", dailyChanges: [-0.024, 0.071, 0.032, -0.051, 0.058, 0.038, -0.035, 0.053] },
];

export const ISSUE_BY_ID = Object.fromEntries(ISSUE_DEFINITIONS.map((item) => [item.id, item])) as Record<IssueId, IssueDefinition>;
