"use client";

import { useEffect, useState } from "react";
import Nav from "../components/Nav";

type Source = {
  _id: string;
  total: number;
  lastScraped: string;
  lastPost: {
    handle: string;
    author_name: string;
    cover_url: string;
    tweet_url: string;
    tweet_text: string;
  };
};

type RecentPost = {
  _id: string;
  handle: string;
  author_name: string;
  cover_url: string;
  tweet_text: string;
  source: string;
  scraped_at: string;
  posted_at?: string;
  tweet_id?: string;
  status: string;
};

type LastRun = {
  source: string;
  ran_at: string;
  new_posts: number;
  total_fetched: number;
};

type Analytics = {
  sources: Source[];
  statusCounts: Record<string, number>;
  recentPosts: RecentPost[];
  postedPosts: RecentPost[];
  lastRun: LastRun | null;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default function Analytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);

  async function fetchAnalytics() {
    const res = await fetch("/api/analytics");
    setData(await res.json());
  }

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function triggerScrape() {
    setScraping(true);
    setScrapeResult(null);
    const res = await fetch("/api/scrape", { method: "POST" });
    const json = await res.json();
    setScrapeResult(json.ok ? json.output : `Error: ${json.error}`);
    setScraping(false);
    fetchAnalytics();
  }

  const total = data ? Object.values(data.statusCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="min-h-screen bg-white text-black">
      <Nav />
      <main className="px-8 py-8 max-w-6xl">

        {/* Status counts */}
        <div className="grid grid-cols-5 gap-4 mb-10">
          {[
            { label: "Total", value: total },
            { label: "Pending", value: data?.statusCounts.pending ?? 0 },
            { label: "Approved", value: data?.statusCounts.approved ?? 0 },
            { label: "Posted", value: data?.statusCounts.posted ?? 0 },
            { label: "Rejected", value: data?.statusCounts.rejected ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="border border-neutral-200 rounded-lg p-5">
              <p className="text-[11px] text-neutral-400 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-3xl font-light">{value}</p>
            </div>
          ))}
        </div>

        {/* Sources */}
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Sources</h2>
          <div className="space-y-3">
            {data?.sources.map((source) => (
              <div key={source._id} className="border border-neutral-200 rounded-lg p-5 flex items-center gap-6">
                <div className="w-12 h-12 rounded overflow-hidden bg-neutral-100 shrink-0">
                  {source.lastPost.cover_url && (
                    <img src={source.lastPost.cover_url} className="w-full h-full object-cover" alt="" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{source._id}</p>
                  <p className="text-[11px] text-neutral-400 truncate">
                    Last: @{source.lastPost.handle} — {source.lastPost.tweet_text?.slice(0, 60)}...
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">{source.total} posts</p>
                  <p className="text-[11px] text-neutral-400">{timeAgo(source.lastScraped)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent scrapes */}
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Recently Scraped</h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {data?.recentPosts.map((post) => (
              <div key={post._id} className="aspect-square rounded overflow-hidden bg-neutral-100 relative group">
                {post.cover_url && (
                  <img src={post.cover_url} className="w-full h-full object-cover" alt="" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                  <p className="text-[9px] text-white leading-tight">@{post.handle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Posted posts */}
        {data?.postedPosts && data.postedPosts.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Posted to X</h2>
            <div className="space-y-2">
              {data.postedPosts.map((post) => (
                <div key={post._id} className="border border-neutral-200 rounded-lg p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded overflow-hidden bg-neutral-100 shrink-0">
                    {post.cover_url && (
                      <img src={post.cover_url} className="w-full h-full object-cover" alt="" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">@{post.handle}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{post.tweet_text?.slice(0, 80)}</p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-3">
                    {post.posted_at && (
                      <p className="text-[11px] text-neutral-400">{timeAgo(post.posted_at)}</p>
                    )}
                    {post.tweet_id && (
                      <a
                        href={`https://x.com/i/web/status/${post.tweet_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-black border border-neutral-200 px-2 py-1 rounded hover:bg-neutral-50"
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scrape button */}
        <div>
          <button
            onClick={triggerScrape}
            disabled={scraping}
            className="px-6 py-2.5 bg-black text-white text-sm rounded hover:bg-neutral-800 transition-colors disabled:opacity-40"
          >
            {scraping ? "Scraping..." : "Scrape Now"}
          </button>
          <div className="mt-3 space-y-1">
            {data?.lastRun && (
              <p className="text-sm text-neutral-400">
                Last run: <span className="text-black">{timeAgo(data.lastRun.ran_at)}</span>
                {" — "}
                <span className="text-black">{data.lastRun.new_posts} new posts</span>
                {" from "}
                <span className="text-black">{data.lastRun.source}</span>
              </p>
            )}
            {scrapeResult && (
              <p className="text-sm text-neutral-500">{scrapeResult}</p>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
