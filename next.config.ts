import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\/(worker|browser)\/.*\.(ts|tsx|js|jsx)$/,
      use: "null-loader",
    });
    return config;
  },
};

export default nextConfig;
