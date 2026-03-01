import axios from "axios";
import net from "net";
import path from "path";
import dotenv from "dotenv";
import { normalizeStateName } from "../utils/normalization";
import { supabase } from "../utils/supabase";
import { VENEZUELA_ISPS } from "../constants/providers";
import { detectNetworkType } from "../utils/classifier";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

/**
 * Omni-Discovery Tool (Country-Wide Mapping) with Supabase Persistence
 * Updates: Enriched metadata (Lat/Lon/Hostname) + VE filtering + Aggressive Mode
 */

const COMMON_PORTS = [
  21, 22, 23, 53, 80, 161, 443, 554, 1900, 2000, 3389, 3478, 37777, 5000, 5060,
  7547, 8000, 8080, 8081, 8291, 8443, 8728, 8888, 9000,
];

async function getPrefixes(asn: number): Promise<string[]> {
  try {
    const url = `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`;
    const resp = await axios.get(url, { timeout: 10000 });
    return resp.data.data.prefixes
      .map((p: any) => p.prefix)
      .filter((p: string) => !p.includes(":"));
  } catch (error: any) {
    console.error(`  Error fetching prefixes for AS${asn}:`, error.message);
    return [];
  }
}

async function isAlive(ip: string, port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.connect(port, ip, () => {
      socket.destroy();
      resolve(port);
    });
    const fail = () => {
      socket.destroy();
      resolve(null);
    };
    socket.on("error", fail);
    socket.on("timeout", fail);
  });
}

async function checkAnyPort(ip: string): Promise<number | null> {
  const results = await Promise.all(COMMON_PORTS.map((p) => isAlive(ip, p)));
  return results.find((r) => r !== null) || null;
}

async function getGeoBatch(ips: string[]): Promise<any[]> {
  if (ips.length === 0) return [];

  // 1. Check Cache first
  const { data: cachedData } = await supabase
    .from("ip_geolocation_cache")
    .select("ip, data")
    .in("ip", ips);

  const cachedIps = new Set(cachedData?.map((d) => d.ip) || []);
  const uncachedIps = ips.filter((ip) => !cachedIps.has(ip));

  let apiResults: any[] = [];

  // 2. Query external API for missing ones
  if (uncachedIps.length > 0) {
    let retries = 3;
    while (retries > 0) {
      try {
        const queries = uncachedIps.map((ip) => ({
          query: ip,
          fields:
            "status,message,countryCode,regionName,city,zip,lat,lon,timezone,reverse,mobile,proxy,query",
        }));
        const resp = await axios.post("http://ip-api.com/batch", queries, {
          timeout: 10000, // 10s timeout for the API itself
        });
        apiResults = resp.data;

        // 3. Save new results to cache
        const cacheEntries = apiResults
          .filter((r) => r.status === "success")
          .map((r) => ({
            ip: r.query,
            data: r,
            updated_at: new Date().toISOString(),
          }));

        if (cacheEntries.length > 0) {
          await supabase.from("ip_geolocation_cache").upsert(cacheEntries);
        }
        break; // Success!
      } catch (error: any) {
        retries--;
        if (retries === 0) {
          console.error(
            "  Error calling ip-api batch (final attempt):",
            error.message,
          );
        } else {
          console.warn(`  ip-api timeout/error, retrying... (${retries} left)`);
          await new Promise((r) => setTimeout(r, 2000)); // wait 2s before retry
        }
      }
    }
  }

  // 4. Combine results
  const combined = [...(cachedData?.map((d) => d.data) || []), ...apiResults];

  return combined;
}

async function isPrefixScanned(prefix: string): Promise<boolean> {
  const { data } = await supabase
    .from("scanned_prefixes")
    .select("prefix")
    .eq("prefix", prefix)
    .single();

  return !!data;
}

async function markPrefixAsScanned(
  prefix: string,
  provider: string,
  asn: number,
) {
  await supabase.from("scanned_prefixes").insert([{ prefix, provider, asn }]);
}

// ... (existing code)

async function saveIpToDb(
  geoResult: any,
  alivePort: number,
  providerName: string,
  asn: number,
) {
  // STRICT FILTER: Only Venezuela
  if (geoResult.countryCode !== "VE") {
    return false;
  }

  const state = normalizeStateName(geoResult.regionName || "desconocido");
  const networkType = detectNetworkType(providerName, asn, geoResult.mobile);

  const { error } = await supabase.from("monitoring_targets").upsert(
    {
      ip: geoResult.query,
      provider: providerName,
      asn,
      state,
      city: geoResult.city,
      zip: geoResult.zip,
      lat: geoResult.lat,
      lon: geoResult.lon,
      timezone: geoResult.timezone,
      hostname: geoResult.reverse,
      is_mobile: networkType === "mobile",
      network_type: networkType,
      is_proxy: geoResult.proxy || false,
      services: [alivePort],
      is_active: true,
    },
    { onConflict: "ip" },
  );

  return !error;
}

/**
 * Generate candidate IPs for a prefix.
 */
function getCandidates(prefix: string, aggressive: boolean = false): string[] {
  const [network, maskStr] = prefix.split("/");
  const mask = parseInt(maskStr);
  const parts = network.split(".").map(Number);

  const candidates: string[] = [];

  // SMART SAMPLING: Priority targets (Gateways, common offsets)
  const priorityOffsets = [1, 2, 5, 10, 25, 50, 69, 100, 150, 200, 254];

  if (aggressive && mask >= 22) {
    // FULL SCAN of prefixes up to /22 (1,024 IPs)
    const totalIps = Math.pow(2, 32 - mask);
    for (let i = 0; i < totalIps; i++) {
      const b3 = Math.floor(i / 256);
      const b4 = i % 256;
      candidates.push(`${parts[0]}.${parts[1]}.${parts[2] + b3}.${b4}`);
    }
  } else if (mask >= 24) {
    priorityOffsets.forEach((n) =>
      candidates.push(`${parts[0]}.${parts[1]}.${parts[2]}.${n}`),
    );
  } else if (mask >= 16) {
    // Mid-range blocks (/23 to /16)
    const count = aggressive ? 800 : 15; // Increased density for aggressive
    const subBlocks = Array.from({ length: count }, (_, i) =>
      i < 64 ? i : Math.floor(Math.random() * Math.pow(2, 24 - mask)),
    );
    subBlocks.forEach((b) => {
      priorityOffsets
        .slice(0, 6)
        .forEach((n) =>
          candidates.push(`${parts[0]}.${parts[1]}.${parts[2] + b}.${n}`),
        );
    });
  } else {
    // Large backbones (/15 and below) - e.g. CANTV
    const count = aggressive ? 2500 : 40; // High density for backbone
    for (let i = 0; i < count; i++) {
      const b2 = Math.floor(Math.random() * Math.pow(2, 24 - mask));
      const b3 = Math.floor(Math.random() * 256);
      const b4 =
        priorityOffsets[Math.floor(Math.random() * priorityOffsets.length)];
      candidates.push(
        `${parts[0]}.${parts[1] + (mask < 16 ? b2 : 0)}.${b3}.${b4}`,
      );
    }
  }

  return Array.from(new Set(candidates)).filter(
    (ip) => !ip.endsWith(".0") && !ip.endsWith(".255"),
  );
}

async function main() {
  const arg = process.argv[2]?.toUpperCase();
  const aggressive = process.argv.includes("--aggressive");
  const fullOnly = process.argv.includes("--full-only");

  let providersToScan = Object.entries(VENEZUELA_ISPS);

  if (arg && !arg.startsWith("--")) {
    if (VENEZUELA_ISPS[arg]) {
      providersToScan = [[arg, VENEZUELA_ISPS[arg]]];
      console.log(
        `--- Starting PROVIDER-SPECIFIC Discovery: ${arg} ${aggressive ? "(AGGRESSIVE)" : ""} ${fullOnly ? "(FULL-SCAN ONLY)" : ""} ---`,
      );
    } else {
      console.error(
        `Error: Provider "${arg}" not found in constants/providers.ts`,
      );
      process.exit(1);
    }
  } else {
    console.log(
      `--- Starting OMNI-DISCOVERY ${aggressive ? "(AGGRESSIVE)" : ""} ${fullOnly ? "(FULL-SCAN ONLY)" : ""} ---`,
    );
  }

  for (const [key, providerInfo] of providersToScan) {
    const { asn, name: providerName } = providerInfo;
    console.log(`\n[${providerName}] Searching AS${asn}...`);
    let prefixes = await getPrefixes(asn).then((p) =>
      p.sort(() => 0.5 - Math.random()),
    );

    // Filter for FULL SCAN blocks only if requested
    if (fullOnly) {
      const originalCount = prefixes.length;
      prefixes = prefixes.filter((p) => {
        const mask = parseInt(p.split("/")[1]);
        return aggressive ? mask >= 22 : mask >= 24;
      });
      console.log(
        `  Filtered: ${prefixes.length}/${originalCount} prefixes match full-scan criteria.`,
      );
    }

    console.log(
      `  Processing ${prefixes.length} prefixes in parallel batches...`,
    );

    const PREFIX_BATCH_SIZE = 2; // Reduced to 2 to avoid overwhelming the network
    for (let i = 0; i < prefixes.length; i += PREFIX_BATCH_SIZE) {
      const batch = prefixes.slice(i, i + PREFIX_BATCH_SIZE);

      await Promise.all(
        batch.map(async (prefix, batchIdx) => {
          const globalIdx = i + batchIdx + 1;

          if (await isPrefixScanned(prefix)) {
            // Uncomment for deep debugging:
            // process.stdout.write(`s`);
            return;
          }

          const candidates = getCandidates(prefix, aggressive);
          process.stdout.write(
            `\n  [${globalIdx}/${prefixes.length}] [${providerName}] Scanning ${prefix} (${candidates.length} IPs)... `,
          );

          const aliveResults = [];
          const CHUNK_SIZE = 25; // Smaller chunks to prevent socket drops
          for (let j = 0; j < candidates.length; j += CHUNK_SIZE) {
            const chunk = candidates.slice(j, j + CHUNK_SIZE);
            const results = await Promise.all(
              chunk.map(async (ip) => {
                const port = await checkAnyPort(ip);
                return port ? { ip, port } : null;
              }),
            );
            aliveResults.push(...results);
          }

          const aliveIps = aliveResults.filter((r) => r !== null) as {
            ip: string;
            port: number;
          }[];

          if (aliveIps.length > 0) {
            console.log(`FOUND ${aliveIps.length} nodes! Geolocating...`);
            const geoResults = await getGeoBatch(aliveIps.map((a) => a.ip));

            let savedCount = 0;
            for (const geo of geoResults) {
              if (geo.status === "success") {
                const aliveInfo = aliveIps.find((a) => a.ip === geo.query);
                const saved = await saveIpToDb(
                  geo,
                  aliveInfo!.port,
                  providerName,
                  asn,
                );
                if (saved) savedCount++;
              }
            }
            if (savedCount > 0) {
              process.stdout.write(
                `  [${providerName}] Saved ${savedCount} new nodes.\n`,
              );
            }
            await new Promise((r) => setTimeout(r, 1000));
          } else {
            process.stdout.write(`Done (0 found).`);
          }

          await markPrefixAsScanned(prefix, providerName, asn);
        }),
      );

      // Progress tick
      process.stdout.write(".");
    }
  }
}

main();
