import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEWSPI | 뉴스를 뽑고, 읽고, 투자하라",
  description: "최신 뉴스를 읽고 퀴즈를 풀어 가상 이슈에 투자하는 뉴스 게임",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
