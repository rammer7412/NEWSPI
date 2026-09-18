// NEWSPI original copy. Cycling these sentences keeps the rescue path available at 0 C.
export const HAPPY_PHRASES = [
  "오늘의 내가 조금 느리게 걷고 있어도 괜찮아요. 멈추지 않고 여기까지 온 것만으로도 충분히 잘하고 있어요.",
  "잘한 일이 떠오르지 않는 날에도 나를 함부로 대하지 않을 거예요. 쉬어 가는 시간 역시 앞으로 가는 과정이에요.",
  "모든 답을 지금 알 필요는 없어요. 작은 질문 하나를 붙잡고 천천히 배우는 나를 믿어 주세요.",
  "누군가와 나를 비교하느라 마음이 지쳤다면 잠시 숨을 골라요. 내 속도로 쌓은 하루에도 분명한 가치가 있어요.",
  "실수한 하루가 나의 전부를 설명하지는 않아요. 다시 시작할 수 있는 용기를 나에게 먼저 건네볼게요.",
  "기분이 흐린 날에는 밝아지려고 애쓰지 않아도 돼요. 지금의 마음을 살피는 일부터 시작해도 괜찮아요.",
] as const;

export function normalizeHappyPhrase(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
