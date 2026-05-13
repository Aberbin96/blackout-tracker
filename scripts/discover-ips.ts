import "./load-env";
import axios from "axios";
import net from "net";
import { normalizeStateName } from "../utils/normalization";
import { VENEZUELA_ISPS } from "../constants/providers";
import { detectNetworkType } from "../utils/classifier";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ipGeolocationCache, monitoringTargets, scannedPrefixes } from "../db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL is missing");
  process.exit(1);
}

const pool = mysql.createPool(DATABASE_URL);
const db = drizzle(pool, { mode: "default" });

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
    socket.connect(port, ip, () => { socket.destroy(); resolve(port); });
    const fail = () => { socket.destroy(); resolve(null); };
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

  const cachedData = await db
    .select({ ip: ipGeolocationCache.ip, data: ipGeolocationCache.data })
    .from(ipGeolocationCache)
    .where(inArray(ipGeolocationCache.ip, ips));

  const cachedIps = new Set(cachedData.map((d) => d.ip));
  const uncachedIps = ips.filter((ip) => !cachedIps.has(ip));
  const apiResults: any[] = [];

  if (uncachedIps.length > 0) {
    const BATCH_LIMIT = 100;
    for (let i = 0; i < uncachedIps.length; i += BATCH_LIMIT) {
      const chunk = uncachedIps.slice(i, i + BATCH_LIMIT);
      let retries = 3;
      while (retries > 0) {
        try {
          const queries = chunk.map((ip) => ({
            query: ip,
            fields: "status,message,countryCode,regionName,city,zip,lat,lon,timezone,reverse,mobile,proxy,query",
          }));
          const resp = await axios.post("http://ip-api.com/batch", queries, { timeout: 15000 });
          const chunkResults = resp.data;
          apiResults.push(...chunkResults);

          const cacheEntries = chunkResults
            .filter((r: any) => r.status === "success")
            .map((r: any) => ({ ip: r.query, data: r, updatedAt: new Date() }));

          if (cacheEntries.length > 0) {
            for (const entry of cacheEntries) {
              await db
                .insert(ipGeolocationCache)
                .values(entry)
                .onDuplicateKeyUpdate({ set: { data: entry.data, updatedAt: new Date() } });
            }
          }
          break;
        } catch (error: any) {
          retries--;
          if (retries === 0) {
            console.error(`  Error calling ip-api batch (final attempt):`, error.message);
          } else {
            const isRateLimit = error.response?.status === 429;
            const waitTime = isRateLimit ? 10000 : 5000;
            console.warn(`  ip-api ${isRateLimit ? "RATE LIMIT" : "timeout"}, waiting ${waitTime / 1000}s... (${retries} left)`);
            await new Promise((r) => setTimeout(r, waitTime));
          }
        }
      }
      if (i + BATCH_LIMIT < uncachedIps.length) {
        await new Promise((r) => setTimeout(r, 4500));
      }
    }
  }

  return [...cachedData.map((d) => d.data), ...apiResults];
}

async function isPrefixScanned(prefix: string): Promise<boolean> {
  const rows = await db
    .select({ prefix: scannedPrefixes.prefix })
    .from(scannedPrefixes)
    .where(eq(scannedPrefixes.prefix, prefix))
    .limit(1);
  return rows.length > 0;
}

async function markPrefixAsScanned(prefix: string, provider: string, asn: number) {
  await db
    .insert(scannedPrefixes)
    .values({ prefix, provider, asn })
    .onDuplicateKeyUpdate({ set: { scannedAt: new Date() } });
}

async function saveIpToDb(geoResult: any, alivePort: number, providerName: string, asn: number) {
  if (geoResult.countryCode !== "VE") return false;

  const state = normalizeStateName(geoResult.regionName || "desconocido");
  const networkType = detectNetworkType(providerName, asn, geoResult.mobile);

  try {
    await db
      .insert(monitoringTargets)
      .values({
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
        isMobile: networkType === "mobile",
        networkType,
        isProxy: geoResult.proxy || false,
        services: [alivePort],
        isActive: true,
      })
      .onDuplicateKeyUpdate({
        set: {
          provider: providerName,
          state,
          city: geoResult.city,
          lat: geoResult.lat,
          lon: geoResult.lon,
          services: [alivePort],
          isActive: true,
        },
      });
    return true;
  } catch (error: any) {
    console.error(`\n  [DB ERROR] Failed to save IP ${geoResult.query}:`, error.message);
    return false;
  }
}

function getCandidates(prefix: string, aggressive: boolean = false): string[] {
  const [network, maskStr] = prefix.split("/");
  const mask = parseInt(maskStr);
  const parts = network.split(".").map(Number);
  const candidates: string[] = [];
  const priorityOffsets = [1, 2, 5, 10, 25, 50, 69, 100, 150, 200, 254];

  if (aggressive) {
    const totalIps = Math.pow(2, 32 - mask);
    for (let i = 0; i < totalIps; i++) {
      const b2 = Math.floor(i / 65536);
      const b3 = Math.floor((i % 65536) / 256);
      const b4 = i % 256;
      candidates.push(`${parts[0]}.${parts[1] + b2}.${parts[2] + b3}.${b4}`);
    }
  } else if (mask >= 24) {
    priorityOffsets.forEach((n) => candidates.push(`${parts[0]}.${parts[1]}.${parts[2]}.${n}`));
  } else if (mask >= 16) {
    const count = 15;
    const subBlocks = Array.from({ length: count }, (_, i) =>
      i < 64 ? i : Math.floor(Math.random() * Math.pow(2, 24 - mask)),
    );
    subBlocks.forEach((b) => {
      priorityOffsets.slice(0, 6).forEach((n) =>
        candidates.push(`${parts[0]}.${parts[1]}.${parts[2] + b}.${n}`)
      );
    });
  } else {
    const count = 40;
    for (let i = 0; i < count; i++) {
      const b2 = Math.floor(Math.random() * Math.pow(2, 24 - mask));
      const b3 = Math.floor(Math.random() * 256);
      const b4 = priorityOffsets[Math.floor(Math.random() * priorityOffsets.length)];
      candidates.push(`${parts[0]}.${parts[1] + (mask < 16 ? b2 : 0)}.${b3}.${b4}`);
    }
  }

  return Array.from(new Set(candidates)).filter((ip) => !ip.endsWith(".0") && !ip.endsWith(".255"));
}

async function main() {
  const providerArg = process.argv.find((a) => a.startsWith("--provider="));
  let targetProviderName = providerArg
    ? providerArg.substring(11).replace(/['"]/g, "").toUpperCase()
    : undefined;

  if (!targetProviderName) {
    const arg = process.argv[2]?.toUpperCase();
    if (arg && !arg.startsWith("--")) targetProviderName = arg;
  }

  const aggressive = process.argv.includes("--aggressive");
  const fullOnly = process.argv.includes("--full-only");
  let providersToScan = Object.entries(VENEZUELA_ISPS);

  if (targetProviderName) {
    const foundEntry = Object.entries(VENEZUELA_ISPS).find(
      ([key, info]) =>
        key === targetProviderName?.replace(/\s+/g, "") ||
        info.name.toUpperCase() === targetProviderName,
    );
    if (foundEntry) {
      providersToScan = [foundEntry];
      console.log(`--- Starting PROVIDER-SPECIFIC Discovery: ${foundEntry[1].name} ---`);
    } else {
      console.error(`Error: Provider "${targetProviderName}" not found`);
      process.exit(1);
    }
  } else {
    console.log(`--- Starting OMNI-DISCOVERY ${aggressive ? "(AGGRESSIVE)" : ""} ---`);
  }

  for (const [, providerInfo] of providersToScan) {
    const { asn, name: providerName } = providerInfo;
    console.log(`\n[${providerName}] Searching AS${asn}...`);
    let prefixes = await getPrefixes(asn).then((p) => p.sort(() => 0.5 - Math.random()));

    if (fullOnly) {
      const originalCount = prefixes.length;
      prefixes = prefixes.filter((p) => {
        const mask = parseInt(p.split("/")[1]);
        return aggressive ? mask >= 22 : mask >= 24;
      });
      console.log(`  Filtered: ${prefixes.length}/${originalCount} prefixes match full-scan criteria.`);
    }

    const scannedRows = await db
      .select({ prefix: scannedPrefixes.prefix })
      .from(scannedPrefixes)
      .where(eq(scannedPrefixes.asn, asn));
    const scannedSet = new Set(scannedRows.map((d) => d.prefix));
    const unscannedPrefixes = prefixes.filter((p) => !scannedSet.has(p));

    console.log(`  [${providerName}] Remaining: ${unscannedPrefixes.length} (Already scanned: ${scannedSet.size})`);

    const PREFIX_BATCH_SIZE = 2;
    for (let i = 0; i < unscannedPrefixes.length; i += PREFIX_BATCH_SIZE) {
      const batch = unscannedPrefixes.slice(i, i + PREFIX_BATCH_SIZE);

      await Promise.all(
        batch.map(async (prefix, batchIdx) => {
          const globalIdx = i + batchIdx + 1;
          const remaining = unscannedPrefixes.length - globalIdx;

          if (await isPrefixScanned(prefix)) return;

          const candidates = getCandidates(prefix, aggressive);
          process.stdout.write(`\n  [Remaining: ${remaining}] [${globalIdx}/${unscannedPrefixes.length}] [${providerName}] Scanning ${prefix} (${candidates.length} IPs)... `);

          const aliveResults: { ip: string; port: number }[] = [];
          const CHUNK_SIZE = 25;
          for (let j = 0; j < candidates.length; j += CHUNK_SIZE) {
            const chunk = candidates.slice(j, j + CHUNK_SIZE);
            const results = await Promise.all(
              chunk.map(async (ip) => {
                const port = await checkAnyPort(ip);
                return port ? { ip, port } : null;
              }),
            );
            aliveResults.push(...(results.filter((r) => r !== null) as { ip: string; port: number }[]));
          }

          if (aliveResults.length > 0) {
            console.log(`FOUND ${aliveResults.length} nodes! Geolocating...`);
            const geoResults = await getGeoBatch(aliveResults.map((a) => a.ip));
            let savedCount = 0;
            for (const geo of geoResults) {
              if (geo.status === "success") {
                const aliveInfo = aliveResults.find((a) => a.ip === geo.query);
                const saved = await saveIpToDb(geo, aliveInfo!.port, providerName, asn);
                if (saved) savedCount++;
              }
            }
            if (savedCount > 0) process.stdout.write(`  [${providerName}] Saved ${savedCount} new nodes.\n`);
            await new Promise((r) => setTimeout(r, 1000));
          } else {
            process.stdout.write(`Done (0 found).`);
          }

          await markPrefixAsScanned(prefix, providerName, asn);
        }),
      );

      process.stdout.write(".");
    }
  }

  await pool.end();
}

main();
