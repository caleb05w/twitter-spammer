"use client";

import { useEffect, useState } from "react";
import Nav from "../components/Nav";

type Settings = {
  scrape_interval_hours: number;
  post_hours_x: number[];
  post_hours_threads: number[];
  post_hours_instagram: number[];
};

const SCRAPE_OPTIONS = [1, 2, 4, 6, 12, 24];

const PLATFORM_SCHEDULE = [
  { label: "X",         key: "post_hours_x" as const },
  { label: "Threads",   key: "post_hours_threads" as const },
  { label: "Instagram", key: "post_hours_instagram" as const },
];

function formatTime(m: number) {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${mins.toString().padStart(2, "0")} ${suffix}`;
}

// Parses "9", "9:30", "9:30am", "9:30 PM", "21:30" → minutes from midnight.
// Rounds to nearest 30. Returns null if unparseable.
function parseTime(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const match = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const mins = parseInt(match[2] ?? "0", 10);
  const period = match[3];
  if (h > 23 || mins > 59) return null;
  if (period === "am" && h === 12) h = 0;
  if (period === "pm" && h !== 12) h += 12;
  const total = h * 60 + mins;
  // Round to nearest 30
  return Math.round(total / 30) * 30 % (24 * 60);
}

function TimeInput({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const [text, setText] = useState(formatTime(value));
  const [invalid, setInvalid] = useState(false);

  function handleBlur() {
    const parsed = parseTime(text);
    if (parsed !== null) {
      setInvalid(false);
      setText(formatTime(parsed));
      onChange(parsed);
    } else {
      setInvalid(true);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  }

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => { setText(e.target.value); setInvalid(false); }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="9:00 AM"
      className={`w-28 border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-neutral-400 ${
        invalid ? "border-red-400 text-red-500" : "border-neutral-200"
      }`}
    />
  );
}

function TimeRows({ times, onChange }: { times: number[]; onChange: (t: number[]) => void }) {
  function setTime(i: number, m: number) {
    const next = [...times];
    next[i] = m;
    onChange(next);
  }
  function remove(i: number) {
    onChange(times.filter((_, idx) => idx !== i));
  }
  function add() {
    if (times.length >= 6) return;
    onChange([...times, 720]);
  }

  return (
    <div className="space-y-1.5">
      {times.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <TimeInput value={m} onChange={(v) => setTime(i, v)} />
          {times.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="text-neutral-300 hover:text-neutral-600 text-sm leading-none"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {times.length < 6 && (
        <button
          onClick={add}
          className="text-[11px] text-neutral-400 hover:text-black transition-colors"
        >
          + Add time
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    scrape_interval_hours: 6,
    post_hours_x:         [540],
    post_hours_threads:   [600],
    post_hours_instagram: [660],
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          scrape_interval_hours: data.scrape_interval_hours,
          post_hours_x:         data.post_hours_x,
          post_hours_threads:   data.post_hours_threads,
          post_hours_instagram: data.post_hours_instagram,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function set<K extends keyof Settings>(key: K, val: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: val }));
  }

  async function save() {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-white">
      <Nav />
      <p className="px-8 py-8 text-sm text-neutral-400">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black">
      <Nav />
      <main className="px-8 py-8 max-w-lg">
        <h1 className="text-xs uppercase tracking-widest text-neutral-400 mb-8">Settings</h1>

        <div className="space-y-8">

          <div>
            <label className="block text-sm font-medium mb-2">Scrape Frequency</label>
            <p className="text-[11px] text-neutral-400 mb-3">How often to check for new posts from sources.</p>
            <div className="flex flex-wrap gap-2">
              {SCRAPE_OPTIONS.map((h) => (
                <button
                  key={h}
                  onClick={() => set("scrape_interval_hours", h)}
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
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Post Times <span className="text-neutral-400 font-normal">(PST)</span>
            </label>
            <p className="text-[11px] text-neutral-400 mb-4">
              One approved post is sent at each scheduled time. Up to 4 per platform.
            </p>
            <div className="space-y-5">
              {PLATFORM_SCHEDULE.map(({ label, key }) => (
                <div key={key} className="flex gap-6">
                  <span className="text-xs font-medium text-neutral-600 w-16 pt-2 shrink-0">{label}</span>
                  <TimeRows times={settings[key]} onChange={(t) => set(key, t)} />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={save}
            className="px-6 py-2.5 bg-black text-white text-sm rounded hover:bg-neutral-800 transition-colors"
          >
            {saved ? "Saved" : "Save Settings"}
          </button>

        </div>
      </main>
    </div>
  );
}
