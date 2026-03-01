import axios from "axios";
import fs from "fs";
import path from "path";

/**
 * Censys IP Gathering Script (Hybrid BGP Discovery + Free Lookup)
 *
 * Works with Censys Free tier by:
 * 1. Discovering ISP ranges via RIPE Stat (BGP).
 * 2. Verifying individual IPs via Censys v3 Lookup API.
 */

const CENSYS_PAT = process.env.CENSYS_PAT;
const OUTPUT_PATH = path.join(process.cwd(), "data/targets/caracas.json");

const ASNS = {
  CANTV: 8048,
  INTER: 21826,
  NET_UNO: 11562,
  DIGITEL: 264726,
};

// Helper to convert CIDR to a sample IP (e.g., .42 of the range)
function getSampleIp(cidr: string): string {
  const [base] = cidr.split("/");
  const parts = base.split(".");
  // Return something safe like .42 or .50 to avoid gateway/broadcast
  return `${parts[0]}.${parts[1]}.${parts[2]}.42`;
}

async function getPrefixesForAsn(asn: number) {
  console.log(`Discovering BGP prefixes for AS${asn}...`);
  try {
    const response = await axios.get(
      `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`,
    );
    const prefixes = response.data.data.prefixes
      .map((p: any) => p.prefix)
      .filter((p: string) => !p.includes(":")); // IPv4 only
    return prefixes;
  } catch (error) {
    console.error(`Error fetching prefixes for AS${asn}:`, error);
    return [];
  }
}

async function verifyIp(ip: string, providerName: string) {
  try {
    const response = await axios.get(
      `https://api.platform.censys.io/v3/global/asset/host/${ip}`,
      {
        headers: {
          Authorization: `Bearer ${CENSYS_PAT}`,
          Accept: "application/json",
        },
      },
    );

    const resource = response.data.result.resource;
    const location = resource.location || {};

    // Check if location matches Caracas, Venezuela
    if (location.city === "Caracas" && location.country_code === "VE") {
      console.log(`[VALID] Found host in Caracas for ${providerName}: ${ip}`);
      return {
        ip: ip,
        provider: providerName,
        asn: resource.autonomous_system.asn,
        services: resource.services?.map((s: any) => s.port) || [],
      };
    }
  } catch (error: any) {
    // 404 means the IP is not in Censys or has no active services
    if (error.response?.status !== 404) {
      console.error(
        `Error looking up ${ip}:`,
        error.response?.data || error.message,
      );
    }
  }
  return null;
}

async function main() {
  if (!CENSYS_PAT) {
    console.error("Error: CENSYS_PAT environment variable is not set.");
    process.exit(1);
  }

  // Load existing IPs to avoid duplicates
  let existingIps: any[] = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      existingIps = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
    } catch (e) {
      existingIps = [];
    }
  }

  const results: any[] = [...existingIps];
  const seenIps = new Set(results.map((r) => r.ip));

  for (const [name, asn] of Object.entries(ASNS)) {
    const prefixes = await getPrefixesForAsn(asn);
    console.log(
      `Found ${prefixes.length} prefixes for ${name}. Testing samples...`,
    );

    // Only test a subset to avoid hitting rate limits/quotas too hard
    // Picking top 15 prefixes for each ISP
    for (const prefix of prefixes.slice(0, 15)) {
      const candidateIp = getSampleIp(prefix);
      if (seenIps.has(candidateIp)) continue;

      const verified = await verifyIp(candidateIp, name);
      if (verified) {
        results.push(verified);
        seenIps.add(candidateIp);
      }

      // Small sleep to respect rate limits
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
  console.log(
    `Verification complete. Total IPs in ${OUTPUT_PATH}: ${results.length}`,
  );
}

main();
