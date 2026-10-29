import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async rewrites() {
    // Set BACKEND_URL only on the Amplify frontend: proxy /api/* to the EC2 backend.
    // beforeFiles is required, otherwise the local app/api routes match first.
    if (!process.env.BACKEND_URL) return [];
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: `${process.env.BACKEND_URL}/api/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            // Force HTTPS for 2 years, include subdomains, eligible for preload list
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // Allow embedding only from same origin (not completely blocked)
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          {
            // Allow microphone for voice input; block camera and geolocation
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
