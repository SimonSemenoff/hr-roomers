"use client";

import { API_URL } from "@/lib/api";

import { useEffect, useState } from "react";

interface Candidate {
  id: string;
  name: string;
  age: string;
  city: string;
  title: string;
  salary: string;
  url: string;
  photo: string;
  summary: string;
  score: number;
  why_fits: string;
  red_flags?: string;
  status: "new" | "viewed" | "interesting" | "rejected";
  source: "hh" | "telegram";
}

interface Props {
  searchId: string | null;
  onBack: () => void;
}

const statusOptions = [
  { value: "new", label: "Новый" },
  { value: "interesting", label: "Интересный" },
  { value: "viewed", label: "Просмотрен" },
  { value: "rejected", label: "Отказ" },
];

const filterTabs = ["Все", "Новый", "Интересный", "Просмотрен", "Отказ"];
const filterValues = ["all", "new", "interesting", "viewed", "rejected"];

function ScoreDot({ score }: { score: number }) {
  const bg = score >= 8 ? "#16A34A" : score >= 6 ? "#D97706" : "#9CA3AF";
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold flex-shrink-0"
      style={{ background: bg }}
    >
      {score}
    </span>
  );
}

export default function CandidateTable({ searchId, onBack }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState<{ title: string; status: string } | null>(null);
  const [filterIdx, setFilterIdx] = useState(0);

  useEffect(() => {
    if (!searchId) return;
    fetchCandidates();
    const interval = setInterval(fetchCandidates, 5000);
    return () => clearInterval(interval);
  }, [searchId]);

  async function fetchCandidates() {
    try {
      const res = await fetch(`${API_URL}/api/search/${searchId}/candidates`);
      const data = await res.json();
      setCandidates(data.candidates || []);
      setSearch(data.search);
    } catch {}
  }

  async function updateStatus(candidateId: string, status: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, status: status as Candidate["status"] } : c))
    );
    await fetch(`${API_URL}/api/candidate/${searchId}/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  const filterVal = filterValues[filterIdx];
  const filtered = filterVal === "all" ? candidates : candidates.filter((c) => c.status === filterVal);
  const isRunning = search?.status === "running";

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <button
            onClick={onBack}
            className="text-xs mb-3 flex items-center gap-1.5 transition-opacity hover:opacity-60"
            style={{ color: "var(--text-muted)" }}
          >
            ← Назад
          </button>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>
            {search?.title || "Кандидаты"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {isRunning ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "#D97706" }}
                />
                Поиск идёт... найдено {candidates.length}
              </span>
            ) : (
              `Найдено ${candidates.length} кандидатов`
            )}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        {filterTabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setFilterIdx(i)}
            className="px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{
              background: filterIdx === i ? "var(--text)" : "var(--surface)",
              color: filterIdx === i ? "#fff" : "var(--text-secondary)",
              border: `1px solid ${filterIdx === i ? "var(--text)" : "var(--border)"}`,
              fontWeight: filterIdx === i ? 500 : 400,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Candidates */}
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
          {isRunning ? "Ищем кандидатов..." : "Кандидатов нет"}
        </div>
      ) : (
        <div className="space-y-3">
          {[...filtered].sort((a, b) => b.score - a.score).map((c) => (
            <div key={c.id} className="card p-5 flex gap-4">
              {/* Avatar */}
              {c.photo ? (
                <img src={c.photo} alt={c.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-base font-semibold"
                  style={{ background: "var(--hover)", color: "var(--text-secondary)" }}
                >
                  {c.name?.[0] || "?"}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold transition-opacity hover:opacity-60"
                      style={{ color: "var(--text)" }}
                    >
                      {c.name}
                    </a>
                    <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{c.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {[c.city, c.age, c.salary].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <ScoreDot score={c.score} />
                    <select
                      value={c.status}
                      onChange={(e) => updateStatus(c.id, e.target.value)}
                      className="input-field"
                      style={{ width: "auto", padding: "6px 10px", fontSize: "13px" }}
                    >
                      {statusOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-sm mt-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {c.summary}
                </p>

                {c.why_fits && (
                  <p className="text-xs mt-2" style={{ color: "#16A34A" }}>
                    ✓ {c.why_fits}
                  </p>
                )}

                {c.red_flags && (
                  <p className="text-xs mt-1" style={{ color: "#D97706" }}>
                    ⚠ {c.red_flags}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
