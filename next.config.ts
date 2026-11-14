import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-only "N" badge, which sits on top of the Today tab.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
