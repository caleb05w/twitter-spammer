"use client";

import { useEffect, useState } from "react";
import Nav from "../components/Nav";
import ProxyImage from "../components/ProxyImage";
import SourceCard from "../components/SourceCard";
import { timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  tweet_url: string;
  source: string;
  scraped_at: string;
  posted_at?: string;
  tweet_id?: string;
  media_type: string;
  status: string;
};

type ScrapeRun = {
  _id: string;
  source: string;
  ran_at: string;
  new_posts: number;
};

type Analytics = {
  sources: Source[];
  statusCounts: Record<string, number>;
  recentPosts: RecentPost[];
  postedPosts: RecentPost[];
  recentRuns: ScrapeRun[];
};


export default function Analytics() {
  const [data, setData] = useState<Analytics | null>(null);

  async function fetchAnalytics() {
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (e) {
      console.error("Failed to load analytics:", e);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const total = data ? Object.values(data.statusCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="px-8 py-8 max-w-6xl">

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-8">
          {[
            { label: "Total", value: total },
            { label: "Pending", value: data?.statusCounts.pending ?? 0 },
            { label: "Approved", value: data?.statusCounts.approved ?? 0 },
            { label: "Posted", value: data?.statusCounts.posted ?? 0 },
            { label: "Rejected", value: data?.statusCounts.rejected ?? 0 },
          ].map(({ label, value }) => (
            <Card key={label} size="sm">
              <CardHeader>
                <CardDescription className="text-[11px] uppercase tracking-widest">{label}</CardDescription>
                <CardTitle className="text-3xl font-light">{value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="sources">
          <TabsList variant="line" className="w-full justify-start mb-6">
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="recently-scraped">Recently Scraped</TabsTrigger>
            <TabsTrigger value="posted">Posted</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
          </TabsList>

          {/* Sources — horizontal scroll row */}
          <TabsContent value="sources">
            <div className="flex flex-row gap-3 overflow-x-auto pb-2">
              {data?.sources.map((source) => (
                <SourceCard key={source._id} source={source} onScraped={fetchAnalytics} />
              ))}
              {!data?.sources.length && (
                <p className="text-sm text-muted-foreground">No sources yet.</p>
              )}
            </div>
          </TabsContent>

          {/* Recently scraped table */}
          <TabsContent value="recently-scraped">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Handle</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Scraped</TableHead>
                  <TableHead>Format</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.recentPosts.map((post) => (
                  <TableRow key={post._id}>
                    <TableCell>
                      <div className="w-8 h-8 rounded overflow-hidden bg-muted shrink-0">
                        {post.cover_url && (
                          <ProxyImage src={post.cover_url} className="w-full h-full object-cover" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={post.tweet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-xs"
                      >
                        @{post.handle}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{post.source}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{timeAgo(post.scraped_at)}</TableCell>
                    <TableCell>
                      {post.media_type ? (
                        <Badge variant="secondary" className="capitalize text-[10px]">{post.media_type}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Posted */}
          <TabsContent value="posted">
            <div className="space-y-2">
              {data?.postedPosts.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing posted yet.</p>
              )}
              {data?.postedPosts.map((post) => (
                <div key={post._id} className="flex items-center gap-4 border rounded-lg p-3">
                  <div className="w-9 h-9 rounded overflow-hidden bg-muted shrink-0">
                    {post.cover_url && (
                      <ProxyImage src={post.cover_url} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">@{post.handle}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{post.tweet_text?.slice(0, 80)}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    {post.posted_at && (
                      <span className="text-[11px] text-muted-foreground">{timeAgo(post.posted_at)}</span>
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
          </TabsContent>
          {/* Runs */}
          <TabsContent value="runs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Ran</TableHead>
                  <TableHead className="text-right">New Posts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.recentRuns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">No runs recorded yet.</TableCell>
                  </TableRow>
                )}
                {data?.recentRuns.map((run) => (
                  <TableRow key={run._id}>
                    <TableCell className="text-xs font-medium">{run.source}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(run.ran_at)}</TableCell>
                    <TableCell className="text-xs text-right">
                      {run.new_posts > 0
                        ? <Badge variant="secondary">+{run.new_posts}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

        </Tabs>

      </main>
    </div>
  );
}
