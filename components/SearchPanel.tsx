"use client";

import { useEffect, useState } from "react";

interface Search {
  id: string;
  title: string;
  status: "running" | "done" | "error";
  params: { keywords: string };
}

interface Props {
  onStarted: (id: string) => void;
  onSelect: (id: string) => void;
}

const statusLabel: Record<string, string> = {
  running: "Ищем...",
  done: "Готово",
  error: "Ошибка",
};

export default function SearchPanel({ onStarted, onSelect }: Props) {
  const [title, setTitle] = useState("Менеджер по продажам HoReCa");
  const [keywords, setKeywords] = useState("HoReCa, рестораны, посуда, морепродукты, стейки, оборудование");
  const [salaryFrom, setSalaryFrom] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [searches, setSearches] = useState<Search[]>([]);

  useEffect(() => {
    fetchSearches();
    const interval = setInterval(fetchSearches, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchSearches() {
    try {
      const res = await fetch("http://localhost:8000/api/searches");
      const data = await res.json();
      setSearches(data.reverse());
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const id = Date.now().toString();
    try {
      await fetch("http://localhost:8000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_id: id,
          title,
          keywords,
          salary_from: salaryFrom ? parseInt(salaryFrom) : null,
          notes,
        }),
      });
      onStarted(id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Поиск кандидатов</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Claude проанализирует резюме и отберёт подходящих
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 max-w-4xl">
        {/* Form */}
        <div className="card p-6">
          <h2 className="text-sm font-medium mb-5" style={{ color: "var(--text)" }}>Новый поиск</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Название вакансии
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Ключевые слова / опыт
              </label>
              <textarea
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                rows={3}
                className="input-field resize-none"
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Зарплата от (₽)
              </label>
              <input
                value={salaryFrom}
                onChange={(e) => setSalaryFrom(e.target.value)}
                type="number"
                placeholder="80 000"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Дополнительные требования
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Например: знает шеф-поваров лично, есть база клиентов..."
                className="input-field resize-none"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? "Запускаем..." : "✦ Найти кандидатов"}
            </button>
          </form>
        </div>

        {/* History */}
        <div>
          <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
            История поисков
          </h2>
          {searches.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Поисков пока нет</p>
          ) : (
            <div className="space-y-2">
              {searches.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className="card w-full text-left px-4 py-3.5 hover:bg-[var(--hover)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                      {s.title}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{
                        background: s.status === "done" ? "#F0FDF4" : s.status === "running" ? "#FFFBEB" : "#FEF2F2",
                        color: s.status === "done" ? "#166534" : s.status === "running" ? "#92400E" : "#991B1B",
                      }}
                    >
                      {statusLabel[s.status]}
                    </span>
                  </div>
                  <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                    {s.params?.keywords}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
