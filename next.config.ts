import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (dev) resolves .js → .ts natively for TypeScript projects.
  // Webpack (next build --webpack) needs explicit extensionAlias for the same.
  // Empty turbopack key silences the "webpack config with no turbopack config" error.
  turbopack: {},
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
