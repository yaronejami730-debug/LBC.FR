import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/listing/:id", destination: "/annonce/:id", permanent: true },
      { source: "/listing/:id/edit", destination: "/annonce/:id/edit", permanent: true },
    ];
  },
};

export default nextConfig;
