import "./globals.css";
import type { Metadata } from "next";
import { ButtonPressEffect } from "@/components/button-press-effect";

export const metadata: Metadata = {
  title: "Fusion Space",
  description: "团队项目协作空间"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <ButtonPressEffect />
        {children}
      </body>
    </html>
  );
}
