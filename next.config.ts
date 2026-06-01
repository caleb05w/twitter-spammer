import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "cdn.bestdesignsonx.com" },
      { hostname: "inspiration-library.b-cdn.net" },
      { hostname: "pbs.twimg.com" },
      { hostname: "favicon.im" },
    ],
  },
};

export default nextConfig;
