import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    // Four validated uploads may total up to 24 MB plus multipart overhead.
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
