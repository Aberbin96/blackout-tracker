import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Configuración para optimizar imports y reducir el tamaño del bundle del servidor
  // (particularmente las Serverless Functions de Vercel)
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "leaflet",
      "react-leaflet",
      "@supabase/supabase-js",
      "@sentry/nextjs",
    ],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "ache",
  project: "blackout",

  silent: !process.env.CI,

  // Detiene la subida de sourcemaps al cliente/sentry para aligerar la compilación
  widenClientFileUpload: false,

  sourcemaps: {
    disable: true,
  },

  // Descomentar esto puede incrementar el tamaño en el endpoint
  // tunnelRoute: "/monitoring",

  automaticVercelMonitors: true,

  disableLogger: true,

  // Agresiva eliminación de código de debug y Replay de Sentry para reducir KB
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
