"use client";

import { useEffect, useState } from "react";
import Nav from "../components/Nav";

type Settings = {
  scrape_interval_hours: number;
  post_hour_pst: number;
};

const SCRAPE_OPTIONS = [1, 2, 4, 6, 12, 24];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    scrape_interval_hours: 6,
    post_hour_pst: 9,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  async function save() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
                  onClick={() => setSettings((s) => ({ ...s, scrape_interval_hours: h }))}
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

          {/* Post time */}
          <div>
            <label className="block text-sm font-medium mb-2">Daily Post Time <span className="text-neutral-400 font-normal">(PST)</span></label>
            <p className="text-[11px] text-neutral-400 mb-3">One approved post will be sent at this time each day.</p>
            <select
              value={settings.post_hour_pst}
              onChange={(e) => setSettings((s) => ({ ...s, post_hour_pst: Number(e.target.value) }))}
              className="border border-neutral-200 rounded px-3 py-2 text-sm w-40 bg-white"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
          </div>

          {/* Save */}
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
