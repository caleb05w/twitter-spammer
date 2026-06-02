"use client";

import { useEffect, useState } from "react";
import Nav from "./components/Nav";
import MediaPreview from "./components/MediaPreview";

type Post = {
  _id: string;
  handle: string;
  author_name: string;
  tweet_url: string;
  tweet_text: string;
  cover_url: string;
  media_url?: string;
  media_type: string;
  source: string;
  ig_handle?: string;
  threads_handle?: string;
};

type Tab = "queue" | "post";
type Platform = "twitter" | "instagram" | "threads";
type PlatformStatus = "idle" | "posting" | "done" | "error";
type PlatformState = { status: PlatformStatus; error?: string };

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "twitter", label: "X" },
  { id: "threads", label: "Threads" },
  { id: "instagram", label: "IG" },
];


export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("queue");
  const [posts, setPosts] = useState<Post[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Post tab state
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [igHandles, setIgHandles] = useState<Record<string, string>>({});
  const [threadsHandles, setThreadsHandles] = useState<Record<string, string>>({});
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, Platform[]>>({});
  const [platformStates, setPlatformStates] = useState<Record<string, Partial<Record<Platform, PlatformState>>>>({});

  async function fetchPosts(status: string, source?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status });
      if (source && source !== "all") params.set("source", source);
      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setPosts(json.posts);
      if (!source || source === "all") setSources(json.sources);
    } finally {
      setLoading(false);
    }
  }

  const tabStatus = tab === "queue" ? "pending" : "approved";

  useEffect(() => {
    setSourceFilter("all");
    fetchPosts(tabStatus);
  }, [tab]);

  function handleSourceFilter(s: string) {
    setSourceFilter(s);
    fetchPosts(tabStatus, s);
  }

  // Queue actions
  async function updateStatus(id: string, status: "approved" | "rejected") {
    const res = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setPosts((prev) => prev.filter((p) => p._id !== id));
  }

  // Post tab actions
  function getDescription(post: Post) {
    return post._id in descriptions ? descriptions[post._id] : (post.tweet_text ?? "");
  }

  function getHandle(post: Post, platform: Platform): string {
    if (platform === "instagram") return igHandles[post._id] ?? post.ig_handle ?? post.handle;
    if (platform === "threads") return threadsHandles[post._id] ?? post.threads_handle ?? post.handle;
    return post.handle;
  }

  function buildPlatformCaption(post: Post, platform: Platform): string {
    const desc = getDescription(post);
    const handle = getHandle(post, platform);
    return desc ? `${desc}\n\nby @${handle}` : `Design by @${handle}`;
  }

  async function saveHandle(post: Post, platform: "instagram" | "threads", value: string) {
    const field = platform === "instagram" ? "ig_handle" : "threads_handle";
    await fetch(`/api/posts/${post._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  function getPostPlatforms(post: Post): Platform[] {
    return selectedPlatforms[post._id] ?? ["twitter"];
  }

  function togglePlatform(postId: string, platform: Platform) {
    setSelectedPlatforms((prev) => {
      const current = prev[postId] ?? ["twitter"];
      const next = current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform];
      return { ...prev, [postId]: next };
    });
  }

  function getPlatformState(postId: string, platform: Platform): PlatformState {
    return platformStates[postId]?.[platform] ?? { status: "idle" };
  }

  function setPS(postId: string, platform: Platform, state: PlatformState) {
    setPlatformStates((prev) => ({
      ...prev,
      [postId]: { ...prev[postId], [platform]: state },
    }));
  }

  async function handlePost(post: Post) {
    const platforms = getPostPlatforms(post);
    if (platforms.length === 0) return;

    setPlatformStates((prev) => ({
      ...prev,
      [post._id]: Object.fromEntries(platforms.map((p) => [p, { status: "idle" }])),
    }));

    let anySucceeded = false;

    for (const platform of platforms) {
      setPS(post._id, platform, { status: "posting" });
      try {
        const res = await fetch(`/api/posts/${post._id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, caption: buildPlatformCaption(post, platform) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        setPS(post._id, platform, { status: "done" });
        anySucceeded = true;
      } catch (e: any) {
        setPS(post._id, platform, { status: "error", error: e.message });
      }
    }

    if (anySucceeded) {
      await new Promise((r) => setTimeout(r, 800));
      setPosts((prev) => prev.filter((p) => p._id !== post._id));
    }
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <Nav />

      {/* Tabs + source filter */}
      <div className="px-8 pt-5 border-b border-neutral-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 text-sm">
            {(["queue", "post"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 capitalize transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? "border-black text-black"
                    : "border-transparent text-neutral-400 hover:text-black"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {sources.length > 1 && (
            <div className="flex gap-2 flex-wrap pb-2">
              {["all", ...sources].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSourceFilter(s)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    sourceFilter === s
                      ? "bg-black text-white border-black"
                      : "border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-black"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="px-8 py-8">
        {loading ? (
          <p className="text-neutral-400 text-sm">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-neutral-400 text-sm">
            No {tab === "queue" ? "pending" : "approved"} posts
            {sourceFilter !== "all" ? ` from ${sourceFilter}` : ""}.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((post) => (
              <div
                key={post._id}
                className="border border-neutral-200 rounded-lg overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-neutral-100 relative overflow-hidden">
                  {post.cover_url || post.media_url ? (
                    <MediaPreview
                      coverUrl={post.cover_url || post.media_url!}
                      mediaUrl={post.media_url}
                      mediaType={post.media_type}
                      alt={post.author_name}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">
                      No image
                    </div>
                  )}
                  {post.media_type === "video" && (
                    <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
                      VIDEO
                    </span>
                  )}
                </div>

                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">@{post.handle}</span>
                    <a
                      href={post.tweet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-neutral-400 hover:text-black ml-auto shrink-0"
                    >
                      ↗
                    </a>
                  </div>

                  {tab === "queue" && (
                    <>
                      <p className="text-[11px] text-neutral-500 line-clamp-2">{post.tweet_text}</p>
                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={() => updateStatus(post._id, "approved")}
                          className="flex-1 py-1.5 bg-black text-white text-xs rounded hover:bg-neutral-800 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(post._id, "rejected")}
                          className="flex-1 py-1.5 border border-neutral-200 text-xs rounded hover:bg-neutral-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </>
                  )}

                  {tab === "post" && (
                    <>
                      <textarea
                        className="w-full text-[11px] text-neutral-700 border border-neutral-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-neutral-400 leading-relaxed"
                        rows={3}
                        placeholder="Description…"
                        value={getDescription(post)}
                        onChange={(e) =>
                          setDescriptions((prev) => ({ ...prev, [post._id]: e.target.value }))
                        }
                      />
                      <div className="space-y-1">
                        {(["twitter", "threads", "instagram"] as const)
                          .filter((p) => getPostPlatforms(post).includes(p))
                          .map((platform) => {
                            const isX = platform === "twitter";
                            const value = isX
                              ? post.handle
                              : platform === "instagram"
                              ? (igHandles[post._id] ?? post.ig_handle ?? post.handle)
                              : (threadsHandles[post._id] ?? post.threads_handle ?? post.handle);
                            const label = isX ? "X" : platform === "instagram" ? "IG" : "Threads";
                            return (
                              <div key={platform} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-neutral-400 w-10 shrink-0">{label}</span>
                                <span className="text-[11px] text-neutral-400">@</span>
                                <input
                                  type="text"
                                  readOnly={isX}
                                  value={value}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(/^@/, "");
                                    if (platform === "instagram") setIgHandles((prev) => ({ ...prev, [post._id]: v }));
                                    else if (platform === "threads") setThreadsHandles((prev) => ({ ...prev, [post._id]: v }));
                                  }}
                                  onBlur={(e) => {
                                    if (!isX) saveHandle(post, platform, e.target.value.replace(/^@/, ""));
                                  }}
                                  className={`flex-1 text-[11px] border rounded px-1.5 py-0.5 focus:outline-none focus:border-neutral-400 ${
                                    isX ? "bg-neutral-50 text-neutral-400 border-neutral-100" : "border-neutral-200"
                                  }`}
                                />
                              </div>
                            );
                          })}
                      </div>
                      <div className="flex items-center gap-1.5 mt-auto flex-wrap">
                        {PLATFORMS.map(({ id, label }) => {
                          const active = getPostPlatforms(post).includes(id);
                          const { status, error } = getPlatformState(post._id, id);
                          return (
                            <div key={id} className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={() => togglePlatform(post._id, id)}
                                disabled={status === "posting"}
                                className={`px-2.5 py-1 text-[11px] rounded border transition-colors disabled:opacity-40 ${
                                  status === "done"
                                    ? "bg-green-500 text-white border-green-500"
                                    : status === "error"
                                    ? "bg-red-500 text-white border-red-500"
                                    : active
                                    ? "bg-black text-white border-black"
                                    : "border-neutral-200 text-neutral-400 hover:border-neutral-400 hover:text-black"
                                }`}
                              >
                                {status === "posting" ? "…" : status === "done" ? "✓" : label}
                              </button>
                              {error && (
                                <span className="text-[9px] text-red-500 max-w-[60px] text-center leading-tight">{error}</span>
                              )}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => handlePost(post)}
                          disabled={
                            getPostPlatforms(post).length === 0 ||
                            PLATFORMS.some((p) => getPlatformState(post._id, p.id).status === "posting")
                          }
                          className="ml-auto px-3 py-1 text-xs bg-black text-white rounded hover:bg-neutral-800 transition-colors disabled:opacity-40"
                        >
                          Post
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
