"use client";

import { API_URL } from "@/lib/api";

import { useEffect, useState } from "react";

interface ProfileFile {
  id: string;
  name: string;
  stored_name: string;
}

interface CompanyProfile {
  description: string;
  links: string[];
  files: ProfileFile[];
}

export default function CompanyProfilePanel() {
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
  const [files, setFiles] = useState<ProfileFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch(`${API_URL}/api/company-profile`);
      const data: CompanyProfile = await res.json();
      setDescription(data.description || "");
      setLinks(data.links || []);
      setFiles(data.files || []);
    } catch {}
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await fetch(`${API_URL}/api/company-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, links }),
      });
      setMsg("Сохранено");
      setTimeout(() => setMsg(""), 2000);
    } finally {
      setSaving(false);
    }
  }

  function addLink() {
    if (!newLink.trim()) return;
    setLinks((prev) => [...prev, newLink.trim()]);
    setNewLink("");
  }

  function removeLink(idx: number) {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/company-profile/files`, {
        method: "POST",
        body: form,
      });
      const entry = await res.json();
      setFiles((prev) => [...prev, entry]);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    await fetch(`${API_URL}/api/company-profile/files/${id}`, { method: "DELETE" });
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Профиль компании</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Опиши, кого Roomers ищет в целом — этот профиль AI учитывает при анализе всех вакансий,
          а также будет подставляться шаблоном при создании новой вакансии.
        </p>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Идеальный портрет кандидата Roomers
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            placeholder="Например: ищем энергичных продавцов с опытом в HoReCa, которые лично знают шеф-поваров и закупщиков ресторанов, разбираются в премиальной посуде и кухонном оборудовании, готовы к командировкам и активному поиску клиентов..."
            className="input-field resize-none"
          />
        </div>

        <div>
          <label className="block text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            Ссылки на успешных кандидатов (соцсети, резюме)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
              placeholder="https://..."
              className="input-field"
              style={{ flex: 1 }}
            />
            <button type="button" onClick={addLink} className="btn-secondary text-sm px-4">
              + Добавить
            </button>
          </div>
          {links.length > 0 && (
            <div className="space-y-1.5">
              {links.map((link, i) => (
                <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <a href={link} target="_blank" rel="noreferrer" className="text-xs truncate hover:underline" style={{ color: "var(--text)" }}>
                    {link}
                  </a>
                  <button onClick={() => removeLink(i)} className="text-xs flex-shrink-0" style={{ color: "#DC2626" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            Примеры успешных резюме (PDF, DOCX, TXT)
          </label>
          <label className="btn-secondary text-sm px-4 inline-flex cursor-pointer">
            {uploading ? "Загрузка..." : "⇡ Загрузить файл"}
            <input type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} disabled={uploading} className="hidden" />
          </label>
          {files.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <a
                    href={`${API_URL}/api/company-profile/files/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs truncate hover:underline"
                    style={{ color: "var(--text)" }}
                  >
                    📄 {f.name}
                  </a>
                  <button onClick={() => removeFile(f.id)} className="text-xs flex-shrink-0" style={{ color: "#DC2626" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
          {msg && <span className="text-xs" style={{ color: "#16A34A" }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}
