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
  hh_vacancy_id?: string | null;
  hh_url?: string | null;
}

interface HhVacancy {
  hh_id: string;
  title: string;
  url: string;
  responses_count: string;
  imported: boolean;
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

function ImportHhModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hhVacancies, setHhVacancies] = useState<HhVacancy[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/sources/hh/vacancies`);
        const data = await res.json();
        if (data.status === "ok") {
          setHhVacancies(data.vacancies);
          setSelected(new Set(data.vacancies.filter((v: HhVacancy) => !v.imported).map((v: HhVacancy) => v.hh_id)));
        } else {
          setError(data.message || "Не удалось получить вакансии");
        }
      } catch {
        setError("Не удалось подключиться к серверу");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    setImporting(true);
    const toImport = hhVacancies.filter((v) => selected.has(v.hh_id) && !v.imported);
    await fetch(`${API_URL}/api/vacancies/import_hh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacancies: toImport }),
    });
    setImporting(false);
    onImported();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>Импорт вакансий с HH.ru</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Выбери вакансии — для каждой создастся карточка, останется заполнить профиль кандидата.
        </p>

        {loading && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Загрузка...</p>}
        {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}

        {!loading && !error && (
          <div className="space-y-2 mb-5">
            {hhVacancies.map((v) => (
              <label
                key={v.hh_id}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer"
                style={{ border: "1px solid var(--border)", background: v.imported ? "var(--bg)" : "var(--surface)" }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(v.hh_id)}
                  disabled={v.imported}
                  onChange={() => toggle(v.hh_id)}
                />
                <div className="flex-1">
                  <div className="text-sm" style={{ color: "var(--text)" }}>{v.title}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Откликов: {v.responses_count} {v.imported && "· уже импортирована"}
                  </div>
                </div>
              </label>
            ))}
            {hhVacancies.length === 0 && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Активных вакансий на HH.ru не найдено</p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={loading || importing || selected.size === 0}
            className="btn-primary flex-1 justify-center"
          >
            {importing ? "Импортируем..." : `Импортировать (${selected.size})`}
          </button>
          <button onClick={onClose} className="btn-secondary">Отмена</button>
        </div>
      </div>
    </div>
  );
}

export default function VacanciesPanel({ onViewCandidates }: Props) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

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
        hh_vacancy_id: vacancy.hh_vacancy_id,
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
          <div className="flex gap-2">
            <button onClick={() => setImporting(true)} className="btn-secondary">
              ⇣ Импорт с HH.ru
            </button>
            <button onClick={() => setCreating(true)} className="btn-primary">
              + Новая вакансия
            </button>
          </div>
        )}
      </div>

      {importing && (
        <ImportHhModal onClose={() => setImporting(false)} onImported={fetchVacancies} />
      )}

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
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{v.title}</h3>
                    {v.hh_vacancy_id && (
                      <a
                        href={v.hh_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] hover:underline"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Импортировано с HH.ru ↗
                      </a>
                    )}
                  </div>
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
