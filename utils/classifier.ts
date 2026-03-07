/**
 * Utility to classify network nodes based on collected metadata.
 */

export type DeviceType =
  | "router"
  | "web_server"
  | "government"
  | "isp_infrastructure"
  | "mikrotik"
  | "ubiquiti"
  | "unknown";

export function classifyDevice(metadata: any): DeviceType {
  const title = String(metadata.http_title || "").toLowerCase();
  const server = String(metadata.http_server || "").toLowerCase();
  const sslCN = String(metadata.ssl_subject || "").toLowerCase();

  // 0. ISP Infrastructure (High Confidence)
  if (
    sslCN.includes("cantv.net") ||
    sslCN.includes("inter.com.ve") ||
    sslCN.includes("netuno.net") ||
    title.includes("cantv") ||
    title.includes("aba prepago")
  ) {
    return "isp_infrastructure";
  }

  // 1. Government sites
  if (
    sslCN.includes(".gob.ve") ||
    title.includes("gobierno") ||
    title.includes("ministerio") ||
    title.includes("alcadia") ||
    title.includes("patria.org.ve")
  ) {
    return "government";
  }

  // 2. MikroTik (Very common in VE WISPs)
  if (
    title.includes("mikrotik") ||
    title.includes("routeros") ||
    server.includes("mikrotik") ||
    title.includes("winbox")
  ) {
    return "mikrotik";
  }

  // 3. Ubiquiti
  if (
    title.includes("airos") ||
    title.includes("ubiquiti") ||
    server.includes("ubnt")
  ) {
    return "ubiquiti";
  }

  // 4. General Routers/Modems
  if (
    title.includes("router") ||
    title.includes("modem") ||
    title.includes("gateway") ||
    title.includes("tplink") ||
    title.includes("dlink") ||
    title.includes("huawei")
  ) {
    return "router";
  }

  // 5. General Web Servers
  if (
    title.length > 0 &&
    (server.includes("nginx") ||
      server.includes("apache") ||
      server.includes("iis"))
  ) {
    return "web_server";
  }

  return "unknown";
}

/**
 * Distinguishes between Mobile (Cellular) and Fixed (Residential/Business) networks.
 */
export function detectNetworkType(
  provider: string,
  asn: number,
  geoMobile: boolean = false,
): "mobile" | "fixed" {
  const p = provider.toUpperCase();

  // 1. High confidence: Known Mobile-only ASN or Provider
  if (p === "DIGITEL" || asn === 27717) return "mobile";

  // 2. Movistar can be both, but usually their AS6306 is mobile-heavy in VE
  if (p === "MOVISTAR" || asn === 6306) return "mobile";

  // 3. Reliable indicator from ip-api
  if (geoMobile) return "mobile";

  // 4. Everything else we track (CANTV, INTER, AIRTEK, THUNDERNET) is fixed/wireless-fixed
  return "fixed";
}
