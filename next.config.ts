import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical (and its deps) must run as a real Node module, not be bundled.
  serverExternalPackages: ['node-ical'],
};

export default nextConfig;
