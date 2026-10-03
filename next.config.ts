import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // next-intl reads the interface language from i18n/request.ts (cookie or browser
  // language; no locale in URLs). This is the alias next-intl's plugin would add;
  // set directly because the plugin loads a native SWC binary we don't need.
  turbopack: {
    resolveAlias: { "next-intl/config": "./i18n/request.ts" },
  },
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias = { ...config.resolve.alias, "next-intl/config": path.resolve(process.cwd(), "i18n/request.ts") };
    return config;
  },
  // ffmpeg-static resolves its binary path at runtime, so it must not be bundled
  serverExternalPackages: ["ffmpeg-static"],
  // Routes that run FFmpeg server-side: duration checks for per-second billing,
  // Demo Studio rendering (which also burns captions with the bundled font) and
  // template thumbnails
  outputFileTracingIncludes: {
    "/api/video-remix": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/actor-swap": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/admin/demo-studio": ["./node_modules/ffmpeg-static/ffmpeg", "./assets/fonts/**/*"],
    "/api/admin/video-templates": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
