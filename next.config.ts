import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Configuración para optimizar imports y reducir el tamaño del bundle del servidor
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

// Exportamos sin el wrapper de Sentry temporalmente para diagnosticar
export default withNextIntl(nextConfig);
