import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static resolves its binary path at runtime, so it must not be bundled
  serverExternalPackages: ["ffmpeg-static"],
  // Routes that run FFmpeg server-side (duration checks for per-second billing)
  outputFileTracingIncludes: {
    "/api/video-remix": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/actor-swap": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
