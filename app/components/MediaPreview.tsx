"use client";

import { useRef, useState } from "react";
import { isCdnUrl } from "@/lib/utils";

function proxied(url: string) {
  return isCdnUrl(url) ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
}

function isVideoUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".mov") || clean.endsWith(".webm");
}

type Props = {
  coverUrl: string;
  mediaUrl?: string;
  mediaType?: string;
  alt?: string;
  className?: string;
};

export default function MediaPreview({ coverUrl, mediaUrl, mediaType, alt = "", className = "" }: Props) {
  const thumbRef = useRef<HTMLVideoElement>(null);
  const playRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  const coverIsVideo = isVideoUrl(coverUrl);
  const isVideo = mediaType === "video";
  // Use cover video for hover play when there's no separate mediaUrl, or when cover is already video
  const hoverSrc = proxied(mediaUrl && !coverIsVideo ? mediaUrl : coverUrl);

  function onEnter() {
    if (!isVideo) return;
    setHovered(true);
    if (coverIsVideo) {
      // single video element — just play it
      thumbRef.current?.play().catch(() => {});
    } else {
      playRef.current?.play().catch(() => {});
    }
  }

  function onLeave() {
    setHovered(false);
    [thumbRef, playRef].forEach((r) => {
      if (r.current) { r.current.pause(); r.current.currentTime = 0; }
    });
  }

  return (
    <div className="relative w-full h-full" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {coverIsVideo ? (
        // Cover is itself a video — use one <video> element for both thumbnail and hover play
        <video
          ref={thumbRef}
          src={proxied(coverUrl)}
          preload="metadata"
          muted
          loop
          playsInline
          className={`absolute inset-0 w-full h-full object-cover ${className}`}
        />
      ) : (
        <>
          <img
            src={proxied(coverUrl)}
            alt={alt}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity ${hovered ? "opacity-0" : "opacity-100"} ${className}`}
          />
          {isVideo && (
            <video
              ref={playRef}
              src={hoverSrc}
              preload="none"
              muted
              loop
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-opacity ${hovered ? "opacity-100" : "opacity-0"} ${className}`}
            />
          )}
        </>
      )}
    </div>
  );
}
