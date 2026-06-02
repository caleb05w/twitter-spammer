import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export function isValidObjectId(id: string): boolean {
  return /^[0-9a-f]{24}$/.test(id);
}

export function isCdnUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith(".b-cdn.net") || hostname.endsWith(".details.so");
  } catch {
    return false;
  }
}
