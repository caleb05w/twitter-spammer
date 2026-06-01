"use client";

import { useEffect, useState } from "react";
import Nav from "./components/Nav";

type Post = {
  _id: string;
  handle: string;
  author_name: string;
  tweet_url: string;
  tweet_text: string;
  cover_url: string;
  media_type: string;
  likes: number;
  views: number;
  status: string;
};

type Tab = "pending" | "approved" | "rejected";

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);

  async function fetchPosts(status: Tab) {
    setLoading(true);
    const res = await fetch(`/api/posts?status=${status}`);
    setPosts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchPosts(tab);
  }, [tab]);

  async function updateStatus(id: string, status: "approved" | "rejected") {
    await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPosts((prev) => prev.filter((p) => p._id !== id));
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <Nav />
      <div className="px-8 pt-6 flex gap-1 text-sm border-b border-neutral-200 pb-0">
        {(["pending", "approved", "rejected"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-black text-black" : "border-transparent text-neutral-400 hover:text-black"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <main className="px-8 py-8">
        {loading ? (
          <p className="text-neutral-400 text-sm">Loading...</p>
        ) : posts.length === 0 ? (
          <p className="text-neutral-400 text-sm">No {tab} posts.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((post) => (
              <div key={post._id} className="border border-neutral-200 rounded-lg overflow-hidden">
                <div className="aspect-square bg-neutral-100 relative overflow-hidden">
                  {post.cover_url ? (
                    <img
                      src={post.cover_url}
                      alt={post.author_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">
                      No image
                    </div>
                  )}
                  {post.media_type === "video" && (
                    <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      VIDEO
                    </span>
                  )}
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium">@{post.handle}</span>
                    <a
                      href={post.tweet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-neutral-400 hover:text-black ml-auto"
                    >
                      X →
                    </a>
                  </div>
                  <p className="text-[11px] text-neutral-500 line-clamp-2 mb-3">{post.tweet_text}</p>
                  <div className="flex gap-2 text-[10px] text-neutral-400 mb-3">
                    <span>{post.likes.toLocaleString()} likes</span>
                    <span>{post.views.toLocaleString()} views</span>
                  </div>

                  {tab === "pending" && (
                    <div className="flex gap-2">
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
