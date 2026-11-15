import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure Static Web Apps(하이브리드)는 앱 크기 제한이 있어 standalone 으로 묶는다
  output: "standalone",
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
