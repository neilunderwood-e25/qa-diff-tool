import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright must not be bundled by Next; keep it external to the server build.
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
