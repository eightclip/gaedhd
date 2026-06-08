import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content Security Policy. Pragmatic, not maximal: it locks framing (clickjacking)
// and pins every fetch/style/script to our own origin, while still allowing Next's
// inline runtime and Tailwind's injected styles. 'unsafe-eval' is dev-only (React
// Refresh needs it). Tighten script-src to a nonce later if you want a stricter policy.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "connect-src 'self'",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// Sent on every response. frame-ancestors + X-Frame-Options stop clickjacking;
// HSTS forces HTTPS; Referrer-Policy keeps URLs (and any ?token= fallback) from
// leaking to third parties; Permissions-Policy denies sensors we never use.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // node-ical (and its deps) must run as a real Node module, not be bundled.
  serverExternalPackages: ['node-ical'],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
