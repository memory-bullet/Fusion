import "./globals.css";
import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";

const notoSansSc = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Fusion Space",
  description: "团队项目协作空间"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${notoSansSc.className} antialiased`}>{children}</body>
    </html>
  );
}
