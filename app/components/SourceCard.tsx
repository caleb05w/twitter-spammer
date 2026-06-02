"use client";

import { useState } from "react";
import ProxyImage from "./ProxyImage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

type Source = {
  _id: string;
  total: number;
  lastScraped: string;
  lastPost: {
    handle: string;
    cover_url: string;
    tweet_text: string;
  } | null;
};

export default function SourceCard({ source, onScraped }: { source: Source; onScraped?: () => void }) {
  const [scraping, setScraping] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleScrape() {
    setScraping(true);
    setResult(null);
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: source._id }),
    });
    const json = await res.json();
    setResult(json.ok ? json.output : `Error: ${json.error}`);
    setScraping(false);
    onScraped?.();
  }

  return (
    <Card className="w-64 shrink-0 flex flex-col justify-between">
      {source.lastPost?.cover_url && (
        <div className="h-36 overflow-hidden">
          <ProxyImage src={source.lastPost.cover_url} className="w-full h-full object-cover" />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>{source._id}</CardTitle>
            <CardDescription className="text-[11px] mt-0.5">{timeAgo(source.lastScraped)}</CardDescription>
          </div>
          <span className="text-xl font-light shrink-0">{source.total}</span>
        </div>
      </CardHeader>
      <CardContent>
        {source.lastPost && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
            @{source.lastPost.handle} — {source.lastPost.tweet_text?.slice(0, 72) ?? ""}
          </p>
        )}
        <Button size="sm" className="w-full" onClick={handleScrape} disabled={scraping}>
          {scraping ? "Scraping..." : "Scrape"}
        </Button>
        {result && (
          <p className="text-[10px] text-muted-foreground mt-2 leading-tight">{result}</p>
        )}
      </CardContent>
    </Card>
  );
}
