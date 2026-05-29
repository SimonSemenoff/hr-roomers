"use client";

type View = "vacancies" | "candidates" | "sources";

interface Props {
  activeView: View;
  onChangeView: (v: View) => void;
}

const nav: { id: View; label: string; icon: string }[] = [
  { id: "vacancies", label: "Вакансии", icon: "○" },
  { id: "candidates", label: "Кандидаты", icon: "≡" },
  { id: "sources", label: "Источники", icon: "⊕" },
];

export default function Sidebar({ activeView, onChangeView }: Props) {
  return (
    <aside
      className="w-[210px] flex-shrink-0 flex flex-col py-7 px-5"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
    >
      <div className="mb-9 px-1">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: "var(--text)" }}
          >
            HR
          </div>
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
        className="px-3 py-3 rounded-lg text-xs leading-relaxed"
        style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
      >
        HH.ru · Telegram · и другие
      </div>
    </aside>
  );
}
