"use client";

import { API_URL } from "@/lib/api";

import { useEffect, useState } from "react";

interface Vacancy {
  id: string;
  title: string;
  keywords: string;
  candidate_profile: string;
  salary_from: number | null;
  notes: string;
  sources: string[];
  last_run?: string;
  candidate_count: number;
  status?: "running" | "done" | "idle";
}

interface Props {
  onViewCandidates: (vacancyId: string) => void;
}

const SOURCES = [
  { id: "hh", label: "HH.ru" },
  { id: "telegram", label: "Telegram" },
];

function VacancyForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Vacancy>;
  onSave: (v: Omit<Vacancy, "id" | "candidate_count" | "status">) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [keywords, setKeywords] = useState(initial?.keywords ?? "HoReCa, рестораны, посуда, морепродукты, стейки");
  const [candidateProfile, setCandidateProfile] = useState(initial?.candidate_profile ?? "");
  const [salaryFrom, setSalaryFrom] = useState(initial?.salary_from?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sources, setSources] = useState<string[]>(initial?.sources ?? ["hh"]);

  function toggleSource(id: string) {
    setSources((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ title, keywords, candidate_profile: candidateProfile, salary_from: salaryFrom ? parseInt(salaryFrom) : null, notes, sources });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Название вакансии</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" required placeholder="Менеджер по продажам HoReCa" />
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Ключевые слова для поиска</label>
        <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={2} className="input-field resize-none" />
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Профиль кандидата
          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#EFF6FF", color: "#2563EB" }}>AI использует это</span>
        </label>
        <textarea
          value={candidateProfile}
          onChange={(e) => setCandidateProfile(e.target.value)}
          rows={5}
          placeholder="Опиши идеального кандидата своими словами. Например: человек с опытом продаж в HoReCa, знает шеф-поваров лично, продавал морепродукты или стейки премиум-класса, понимает кухню изнутри. Может быть бывший управляющий ресторана. Готов работать активно, есть своя база клиентов."
          className="input-field resize-none"
        />
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Зарплата от (₽)</label>
        <input value={salaryFrom} onChange={(e) => setSalaryFrom(e.target.value)} type="number" placeholder="80 000" className="input-field" />
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Дополнительные требования</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Например: знает шеф-поваров лично, есть база клиентов..." className="input-field resize-none" />
      </div>

      <div>
        <label className="block text-xs mb-2" style={{ color: "var(--text-secondary)" }}>Источники поиска</label>
        <div className="flex gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSource(s.id)}
              className="px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                background: sources.includes(s.id) ? "var(--text)" : "var(--surface)",
                color: sources.includes(s.id) ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${sources.includes(s.id) ? "var(--text)" : "var(--border)"}`,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1 justify-center">Сохранить</button>
        <button type="button" onClick={onCancel} className="btn-secondary">Отмена</button>
      </div>
    </form>
  );
}

export default function VacanciesPanel({ onViewCandidates }: Props) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchVacancies();
    const interval = setInterval(fetchVacancies, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchVacancies() {
    try {
      const res = await fetch(`${API_URL}/api/vacancies`);
      setVacancies(await res.json());
    } catch {}
  }

  async function handleCreate(data: Omit<Vacancy, "id" | "candidate_count" | "status">) {
    await fetch(`${API_URL}/api/vacancies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Date.now().toString(), ...data, candidate_count: 0 }),
    });
    setCreating(false);
    fetchVacancies();
  }

  async function handleEdit(id: string, data: Omit<Vacancy, "id" | "candidate_count" | "status">) {
    await fetch(`${API_URL}/api/vacancies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingId(null);
    fetchVacancies();
  }

  async function handleSearch(vacancy: Vacancy) {
    await fetch(`${API_URL}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        search_id: vacancy.id,
        title: vacancy.title,
        keywords: vacancy.keywords,
        candidate_profile: vacancy.candidate_profile,
        salary_from: vacancy.salary_from,
        notes: vacancy.notes,
        sources: vacancy.sources,
      }),
    });
    fetchVacancies();
  }

  async function handleDelete(id: string) {
    await fetch(`${API_URL}/api/vacancies/${id}`, { method: "DELETE" });
    fetchVacancies();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Вакансии</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Создавай вакансии и запускай поиск кандидатов
          </p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-primary">
            + Новая вакансия
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 max-w-5xl">
        {/* Create form */}
        {creating && (
          <div className="card p-6 col-span-2 max-w-xl">
            <h2 className="text-sm font-medium mb-5" style={{ color: "var(--text)" }}>Новая вакансия</h2>
            <VacancyForm onSave={handleCreate} onCancel={() => setCreating(false)} />
          </div>
        )}

        {/* Vacancy cards */}
        {vacancies.map((v) => (
          <div key={v.id} className="card p-5">
            {editingId === v.id ? (
              <>
                <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text)" }}>Редактировать</h3>
                <VacancyForm
                  initial={v}
                  onSave={(data) => handleEdit(v.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{v.title}</h3>
                  {v.status === "running" && (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ background: "#FFFBEB", color: "#92400E" }}
                    >
                      Ищем...
                    </span>
                  )}
                </div>

                {v.candidate_profile && (
                  <div
                    className="text-xs mb-3 p-3 rounded-lg leading-relaxed"
                    style={{ background: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE" }}
                  >
                    <span className="font-medium">Профиль: </span>{v.candidate_profile.slice(0, 120)}{v.candidate_profile.length > 120 ? "..." : ""}
                  </div>
                )}

                <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {v.keywords}
                </p>

                <div className="flex items-center gap-2 mb-4">
                  {v.sources?.map((s) => (
                    <span
                      key={s}
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      {s === "hh" ? "HH.ru" : "Telegram"}
                    </span>
                  ))}
                  {v.salary_from && (
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      от {v.salary_from.toLocaleString("ru")} ₽
                    </span>
                  )}
                </div>

                {v.candidate_count > 0 && (
                  <button
                    onClick={() => onViewCandidates(v.id)}
                    className="text-xs mb-3 hover:opacity-60 transition-opacity"
                    style={{ color: "var(--text)" }}
                  >
                    {v.candidate_count} кандидатов →
                  </button>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSearch(v)}
                    disabled={v.status === "running"}
                    className="btn-primary text-xs px-3 py-2 flex-1 justify-center"
                  >
                    {v.status === "running" ? "Ищем..." : "✦ Запустить поиск"}
                  </button>
                  <button
                    onClick={() => setEditingId(v.id)}
                    className="btn-secondary text-xs px-3 py-2"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="btn-secondary text-xs px-3 py-2"
                    style={{ color: "#DC2626", borderColor: "#FECACA" }}
                  >
                    ✕
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {vacancies.length === 0 && !creating && (
          <div
            className="col-span-2 text-center py-16 rounded-xl border-2 border-dashed"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <p className="text-sm">Вакансий пока нет</p>
            <p className="text-xs mt-1">Нажми «Новая вакансия» чтобы начать</p>
          </div>
        )}
      </div>
    </div>
  );
}
