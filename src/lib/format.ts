export const formatNumber = (value: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
export const formatCoin = (value: number) => `${formatNumber(value)} C`;
export const formatPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
export const formatCountdown = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function formatPublishedAt(value: string, isFallback: boolean): string {
  if (isFallback) return "데모 시나리오";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "게시 시간 미상";
  }
}
