"use client";

type Props = {
  src: string;
  alt?: string;
  className?: string;
};

function proxied(url: string) {
  return url.includes("b-cdn.net") ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
}

function isVideo(url: string) {
  return url.includes(".mp4");
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
