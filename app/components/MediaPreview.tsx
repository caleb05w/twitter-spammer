"use client";

import { useRef, useState } from "react";
import { isCdnUrl } from "@/lib/utils";

function proxied(url: string) {
  return isCdnUrl(url) ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
}

type Props = {
  coverUrl: string;
  mediaUrl?: string;
  mediaType?: string;
  alt?: string;
  className?: string;
};

export default function MediaPreview({ coverUrl, mediaUrl, mediaType, alt = "", className = "" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const isVideo = mediaType === "video" && !!mediaUrl;

  function onEnter() {
    if (!isVideo) return;
    setHovered(true);
    videoRef.current?.play().catch(() => {});
  }

  function onLeave() {
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  return (
    <div className="relative w-full h-full" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <img
        src={proxied(coverUrl)}
        alt={alt}
        loading="lazy"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity ${hovered ? "opacity-0" : "opacity-100"} ${className}`}
      />
      {isVideo && (
        <video
          ref={videoRef}
          src={proxied(mediaUrl!)}
          preload="none"
          muted
          loop
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ${hovered ? "opacity-100" : "opacity-0"} ${className}`}
        />
      )}
    </div>
  );
}
