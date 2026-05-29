"use client";

import { useEffect, useState } from "react";

interface SourceStatus {
  id: string;
  name: string;
  connected: boolean;
  account?: string;
  description: string;
}

export default function SourcesPanel() {
  const [sources, setSources] = useState<SourceStatus[]>([
    { id: "hh", name: "HH.ru", connected: false, description: "Поиск по базе резюме. Войди через браузер — один раз." },
    { id: "telegram", name: "Telegram", connected: false, description: "Мониторинг HoReCa каналов и групп. Нужен номер телефона." },
  ]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [tgPhone, setTgPhone] = useState("");
  const [tgCode, setTgCode] = useState("");
  const [tgStep, setTgStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchStatuses();
  }, []);

  async function fetchStatuses() {
    try {
      const res = await fetch("http://localhost:8000/api/sources");
      const data = await res.json();
      setSources((prev) =>
        prev.map((s) => {
          const found = data.find((d: SourceStatus) => d.id === s.id);
          return found ? { ...s, ...found } : s;
        })
      );
    } catch {}
  }

  async function connectHH() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("http://localhost:8000/api/sources/hh/connect", { method: "POST" });
      const data = await res.json();
      if (data.status === "ok") {
        setMsg("HH.ru подключён успешно!");
        fetchStatuses();
        setConnectingId(null);
      } else {
        setMsg(data.message || "Ошибка подключения");
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendTgPhone() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("http://localhost:8000/api/sources/telegram/send_code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: tgPhone }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setTgStep("code");
        setMsg("Код отправлен в Telegram");
      } else {
        setMsg(data.message || "Ошибка");
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendTgCode() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("http://localhost:8000/api/sources/telegram/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: tgPhone, code: tgCode }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setMsg("Telegram подключён!");
        fetchStatuses();
        setConnectingId(null);
        setTgStep("phone");
        setTgPhone("");
        setTgCode("");
      } else {
        setMsg(data.message || "Неверный код");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Источники</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Подключи аккаунты — агент будет искать кандидатов от твоего имени
        </p>
      </div>

      <div className="space-y-4 max-w-xl">
        {sources.map((source) => (
          <div key={source.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background: source.connected ? "#F0FDF4" : "var(--bg)", color: source.connected ? "#16A34A" : "var(--text-muted)", border: "1px solid var(--border)" }}
                >
                  {source.id === "hh" ? "HH" : "TG"}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{source.name}</p>
                  {source.account && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{source.account}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: source.connected ? "#F0FDF4" : "var(--bg)",
                    color: source.connected ? "#16A34A" : "var(--text-muted)",
                    border: `1px solid ${source.connected ? "#BBF7D0" : "var(--border)"}`,
                  }}
                >
                  {source.connected ? "Подключён" : "Не подключён"}
                </span>
                <button
                  onClick={() => setConnectingId(connectingId === source.id ? null : source.id)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  {source.connected ? "Переподключить" : "Подключить"}
                </button>
              </div>
            </div>

            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{source.description}</p>

            {/* HH connect */}
            {connectingId === "hh" && source.id === "hh" && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                  Нажми кнопку — откроется браузер. Войди в HH.ru как обычно.
                </p>
                <button onClick={connectHH} disabled={loading} className="btn-primary text-xs">
                  {loading ? "Открываем браузер..." : "Открыть браузер и войти"}
                </button>
                {msg && <p className="text-xs mt-2" style={{ color: "#16A34A" }}>{msg}</p>}
              </div>
            )}

            {/* Telegram connect */}
            {connectingId === "telegram" && source.id === "telegram" && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                {tgStep === "phone" ? (
                  <>
                    <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                      Введи номер телефона — придёт код в Telegram
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={tgPhone}
                        onChange={(e) => setTgPhone(e.target.value)}
                        placeholder="+7 900 000 00 00"
                        className="input-field"
                        style={{ flex: 1 }}
                      />
                      <button onClick={sendTgPhone} disabled={loading || !tgPhone} className="btn-primary text-xs px-4">
                        {loading ? "..." : "Отправить"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                      Введи код из Telegram
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={tgCode}
                        onChange={(e) => setTgCode(e.target.value)}
                        placeholder="12345"
                        className="input-field"
                        style={{ flex: 1 }}
                        maxLength={6}
                      />
                      <button onClick={sendTgCode} disabled={loading || !tgCode} className="btn-primary text-xs px-4">
                        {loading ? "..." : "Подтвердить"}
                      </button>
                    </div>
                    <button onClick={() => setTgStep("phone")} className="text-xs mt-2 hover:opacity-60" style={{ color: "var(--text-muted)" }}>
                      ← Изменить номер
                    </button>
                  </>
                )}
                {msg && (
                  <p className="text-xs mt-2" style={{ color: msg.includes("ошибка") || msg.includes("Неверный") ? "#DC2626" : "#16A34A" }}>
                    {msg}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Coming soon */}
        <div className="card p-5" style={{ opacity: 0.5 }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              +
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Другие источники</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>LinkedIn, Instagram — скоро</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
