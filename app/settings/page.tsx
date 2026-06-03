"use client";

import { useEffect, useState } from "react";
import Nav from "../components/Nav";

type Settings = {
  scrape_interval_hours: number;
  post_hours_x: number[];
  post_hours_threads: number[];
  post_hours_instagram: number[];
  auto_run: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SCRAPE_OPTIONS = [1, 2, 4, 6, 12, 24];

const PLATFORMS: { key: keyof Pick<Settings, "post_hours_x" | "post_hours_threads" | "post_hours_instagram">; label: string }[] = [
  { key: "post_hours_x", label: "X" },
  { key: "post_hours_threads", label: "Threads" },
  { key: "post_hours_instagram", label: "Instagram" },
];

function formatTime(m: number): string {
  const h = Math.floor(m / 60);
  const mn = m % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${mn.toString().padStart(2, "0")} ${suffix}`;
}

function parseTime(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const match = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const mn = parseInt(match[2] ?? "0", 10);
  const period = match[3];
  if (h > 23 || mn > 59) return null;
  if (period === "am" && h === 12) h = 0;
  if (period === "pm" && h !== 12) h += 12;
  return (Math.round((h * 60 + mn) / 30) * 30) % 1440;
}

function toSettings(data: Record<string, unknown>): Settings {
  return {
    scrape_interval_hours: (data.scrape_interval_hours as number) ?? 6,
    post_hours_x: (data.post_hours_x as number[]) ?? [540],
    post_hours_threads: (data.post_hours_threads as number[]) ?? [600],
    post_hours_instagram: (data.post_hours_instagram as number[]) ?? [660],
    auto_run: (data.auto_run as boolean) ?? false,
  };
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map: Record<SaveState, { label: string; cls: string }> = {
    idle:   { label: "",               cls: "" },
    saving: { label: "Saving…",        cls: "text-neutral-400" },
    saved:  { label: "Saved",          cls: "text-green-600" },
    error:  { label: "Failed to save", cls: "text-red-500 font-medium" },
  };
  const { label, cls } = map[state];
  return <span className={`text-[11px] ${cls}`}>{label}</span>;
}

function TimeInput({ value, onCommit }: { value: number; onCommit: (m: number) => void }) {
  const [text, setText] = useState(formatTime(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(formatTime(value));
    setInvalid(false);
  }, [value]);

  function commit() {
    const parsed = parseTime(text);
    if (parsed !== null) {
      setInvalid(false);
      setText(formatTime(parsed));
      if (parsed !== value) onCommit(parsed);
    } else {
      setInvalid(true);
    }
  }

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => { setText(e.target.value); setInvalid(false); }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder="9:00 AM"
      className={`w-28 border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-neutral-400 ${
        invalid ? "border-red-400 text-red-500" : "border-neutral-200"
      }`}
    />
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<Record<string, SaveState>>({});

  async function load() {
    const r = await fetch("/api/settings");
    const data = await r.json();
    setSettings(toSettings(data));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function setFieldState(key: string, s: SaveState) {
    setStates((prev) => ({ ...prev, [key]: s }));
  }

  async function persist(key: string, value: unknown) {
    setFieldState(key, "saving");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Request failed");
      }
      // Always refetch to confirm what's actually in DB
      const fresh = await fetch("/api/settings").then((r) => r.json());
      setSettings(toSettings(fresh));
      setFieldState(key, "saved");
      setTimeout(() => setFieldState(key, "idle"), 2500);
    } catch {
      setFieldState(key, "error");
      // Revert to DB ground truth
      const fresh = await fetch("/api/settings").then((r) => r.json()).catch(() => null);
      if (fresh) setSettings(toSettings(fresh));
    }
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-white">
        <Nav />
        <p className="px-8 py-8 text-sm text-neutral-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <Nav />
      <main className="px-8 py-8 max-w-lg">
        <h1 className="text-xs uppercase tracking-widest text-neutral-400 mb-8">Settings</h1>

        <div className="space-y-10">

          {/* Scrape frequency */}
          <section>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-medium">Scrape Frequency</span>
              <SaveBadge state={states.scrape_interval_hours ?? "idle"} />
            </div>
            <p className="text-[11px] text-neutral-400 mb-3">How often to check sources for new posts.</p>
            <div className="flex flex-wrap gap-2">
              {SCRAPE_OPTIONS.map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    setSettings((s) => s ? { ...s, scrape_interval_hours: h } : s);
                    persist("scrape_interval_hours", h);
                  }}
                  className={`px-4 py-2 rounded text-sm border transition-colors ${
                    settings.scrape_interval_hours === h
                      ? "bg-black text-white border-black"
                      : "border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  Every {h}h
                </button>
              ))}
            </div>
          </section>

          {/* Post times */}
          <section>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">Post Times</span>
              <span className="text-[11px] text-neutral-400">(Pacific Time)</span>
            </div>
            <p className="text-[11px] text-neutral-400 mb-5">
              One approved post per slot. Up to 6 per platform. Changes save immediately.
            </p>

            <div className="space-y-6">
              {PLATFORMS.map(({ key, label }) => {
                const times = settings[key];
                const state = states[key] ?? "idle";

                function updateTimes(next: number[]) {
                  setSettings((s) => s ? { ...s, [key]: next } : s);
                  persist(key, next);
                }

                return (
                  <div key={key}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-medium text-neutral-500 w-20 shrink-0">{label}</span>
                      <SaveBadge state={state} />
                    </div>
                    <div className="ml-20 space-y-1.5">
                      {times.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <TimeInput
                            value={m}
                            onCommit={(v) => {
                              const next = [...times];
                              next[i] = v;
                              updateTimes(next);
                            }}
                          />
                          {times.length > 1 && (
                            <button
                              onClick={() => updateTimes(times.filter((_, idx) => idx !== i))}
                              className="text-neutral-300 hover:text-neutral-700 text-xl leading-none"
                              title="Remove"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {times.length < 6 && (
                        <button
                          onClick={() => updateTimes([...times, 720])}
                          className="text-[11px] text-neutral-400 hover:text-black transition-colors"
                        >
                          + Add time
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Auto-run */}
          <section>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-medium">Auto-Run</span>
              <SaveBadge state={states.auto_run ?? "idle"} />
            </div>
            <p className="text-[11px] text-neutral-400 mb-3">
              When no approved posts are queued, automatically pick from pending and post.
            </p>
            <button
              role="switch"
              aria-checked={settings.auto_run}
              onClick={() => {
                const next = !settings.auto_run;
                setSettings((s) => s ? { ...s, auto_run: next } : s);
                persist("auto_run", next);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                settings.auto_run ? "bg-black" : "bg-neutral-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.auto_run ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </section>

        </div>
      </main>
    </div>
  );
}
