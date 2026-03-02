import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "ache",
  project: "blackout",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: false,

  sourcemaps: {
    disable: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // tunnelRoute: "/monitoring",
  webpack: {
    automaticVercelMonitors: true,

    treeshake: {
      removeDebugLogging: true,
    },
  },
});
