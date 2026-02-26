import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "ache",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // tunnelRoute: "/monitoring", // Optional: Uncomment if ad-blocker bypassing is needed
  disableLogger: true,
});
