import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR Roomers",
  description: "Поиск кандидатов через HH.ru и Telegram",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body style={{ background: "var(--bg)" }}>{children}</body>
    </html>
  );
}
