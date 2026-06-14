"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

type View = "vacancies" | "candidates" | "sources" | "profile";

interface Props {
  activeView: View;
  onChangeView: (v: View) => void;
}

const nav: { id: View; label: string; icon: string }[] = [
  { id: "vacancies", label: "Вакансии", icon: "○" },
  { id: "candidates", label: "Кандидаты", icon: "≡" },
  { id: "profile", label: "Профиль компании", icon: "★" },
  { id: "sources", label: "Источники", icon: "⊕" },
];

export default function Sidebar({ activeView, onChangeView }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className="w-[210px] flex-shrink-0 flex flex-col py-7 px-5"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
    >
      <div className="mb-9 px-1">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Roomers" width={28} height={28} className="flex-shrink-0" />
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            HR Roomers
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5">
        {nav.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left"
              style={{
                background: active ? "var(--hover)" : "transparent",
                color: active ? "var(--text)" : "var(--text-secondary)",
                fontWeight: active ? 500 : 400,
              }}
            >
              <span className="text-xs w-4 text-center" style={{ opacity: 0.6 }}>
                {item.icon}
              </span>
              {item.label}
              {item.id === "sources" && (
                <span
                  className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "#EFF6FF", color: "#2563EB" }}
                >
                  AI
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div
        className="px-3 py-3 rounded-lg text-xs leading-relaxed mb-3"
        style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
      >
        HH.ru · Telegram · и другие
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
        style={{ color: "var(--text-muted)" }}
      >
        <span className="text-xs w-4 text-center" style={{ opacity: 0.6 }}>→</span>
        Выйти
      </button>
    </aside>
  );
}
