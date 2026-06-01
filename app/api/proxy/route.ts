import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  const fetchHeaders: HeadersInit = { Referer: "https://www.details.so" };
  const range = req.headers.get("range");
  if (range) fetchHeaders["Range"] = range;

  const res = await fetch(url, { headers: fetchHeaders });

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const contentRange = res.headers.get("content-range");
  const contentLength = res.headers.get("content-length");
  const buffer = await res.arrayBuffer();

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=86400",
    "Accept-Ranges": "bytes",
  };
  if (contentRange) headers["Content-Range"] = contentRange;
  if (contentLength) headers["Content-Length"] = contentLength;

  return new NextResponse(buffer, {
    status: res.status,
    headers,
  });
}
