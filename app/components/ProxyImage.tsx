"use client";

type Props = {
  src: string;
  alt?: string;
  className?: string;
};

function proxied(url: string) {
  try {
    const { hostname } = new URL(url);
    if (hostname.endsWith(".b-cdn.net") || hostname.endsWith(".details.so")) {
      return `/api/proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
}

function isVideo(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".mov") || clean.endsWith(".webm");
}

export default function ProxyImage({ src, alt = "", className }: Props) {
  if (isVideo(src)) {
    return (
      <video
        src={proxied(src)}
        className={className}
        muted
        loop
        playsInline
        preload="metadata"
        onMouseEnter={(e) => { const v = e.currentTarget; v.load(); v.play().catch(() => {}); }}
        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
      />
    );
  }
  return <img src={proxied(src)} alt={alt} className={className} />;
}
