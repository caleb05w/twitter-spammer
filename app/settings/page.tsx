"use client";

import { useEffect, useState } from "react";
import Nav from "../components/Nav";

type Settings = {
  scrape_interval_hours: number;
  post_hour_pst: number;
  post_hour_pst_threads: number;
  post_hour_pst_instagram: number;
  post_frequency_x: number;
  post_frequency_threads: number;
  post_frequency_instagram: number;
};

const SCRAPE_OPTIONS = [1, 2, 4, 6, 12, 24];
const FREQUENCY_OPTIONS = [1, 2, 3, 4];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

function postHours(startHour: number, frequency: number): number[] {
  const interval = Math.floor(24 / frequency);
  return Array.from({ length: frequency }, (_, i) => (startHour + i * interval) % 24);
}

const PLATFORM_SCHEDULE = [
  { label: "X",         hourKey: "post_hour_pst" as const,          freqKey: "post_frequency_x" as const },
  { label: "Threads",   hourKey: "post_hour_pst_threads" as const,   freqKey: "post_frequency_threads" as const },
  { label: "Instagram", hourKey: "post_hour_pst_instagram" as const, freqKey: "post_frequency_instagram" as const },
];

function HourSelect({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="border border-neutral-200 rounded px-3 py-2 text-sm w-32 bg-white"
    >
      {HOURS.map((h) => (
        <option key={h} value={h}>{formatHour(h)}</option>
      ))}
    </select>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    scrape_interval_hours: 6,
    post_hour_pst: 9,
    post_hour_pst_threads: 10,
    post_hour_pst_instagram: 11,
    post_frequency_x: 1,
    post_frequency_threads: 1,
    post_frequency_instagram: 1,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          scrape_interval_hours: data.scrape_interval_hours,
          post_hour_pst: data.post_hour_pst,
          post_hour_pst_threads: data.post_hour_pst_threads,
          post_hour_pst_instagram: data.post_hour_pst_instagram,
          post_frequency_x: data.post_frequency_x,
          post_frequency_threads: data.post_frequency_threads,
          post_frequency_instagram: data.post_frequency_instagram,
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

          {/* Scrape frequency */}
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

          {/* Post schedule per platform */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Post Schedule <span className="text-neutral-400 font-normal">(PST)</span>
            </label>
            <p className="text-[11px] text-neutral-400 mb-4">
              First post time and how many times per day. Posts are distributed evenly across 24h.
            </p>
            <div className="space-y-4">
              {PLATFORM_SCHEDULE.map(({ label, hourKey, freqKey }) => {
                const hours = postHours(settings[hourKey], settings[freqKey]);
                return (
                  <div key={label}>
                    <p className="text-xs font-medium text-neutral-600 mb-2">{label}</p>
                    <div className="flex items-center gap-3">
                      <HourSelect value={settings[hourKey]} onChange={(h) => set(hourKey, h)} />
                      <div className="flex gap-1">
                        {FREQUENCY_OPTIONS.map((f) => (
                          <button
                            key={f}
                            onClick={() => set(freqKey, f)}
                            className={`w-8 h-8 text-xs rounded border transition-colors ${
                              settings[freqKey] === f
                                ? "bg-black text-white border-black"
                                : "border-neutral-200 hover:border-neutral-400"
                            }`}
                          >
                            {f}×
                          </button>
                        ))}
                      </div>
                    </div>
                    {settings[freqKey] > 1 && (
                      <p className="text-[10px] text-neutral-400 mt-1.5">
                        Posts at {hours.map(formatHour).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
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
