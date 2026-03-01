import axios from "axios";
import net from "net";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { VENEZUELA_ISPS } from "../constants/providers";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase credentials not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Omni-Discovery Tool (Country-Wide Mapping) with Supabase Persistence
 * Updates: Enriched metadata (Lat/Lon/Hostname) + VE filtering + Aggressive Mode
 */

const COMMON_PORTS = [
  22, 53, 80, 161, 443, 2000, 5060, 7547, 8080, 8081, 8291, 8443, 8728, 8888,
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
    socket.setTimeout(2000);
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
  try {
    const queries = ips.map((ip) => ({
      query: ip,
      fields:
        "status,message,countryCode,regionName,city,zip,lat,lon,timezone,reverse,mobile,proxy,query",
    }));
    const resp = await axios.post("http://ip-api.com/batch", queries);
    return resp.data;
  } catch (error) {
    return [];
  }
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

const normalizeStateName = (name: string) => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

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
      is_mobile: geoResult.mobile || false,
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

  if (aggressive && mask >= 24) {
    // FULL SCAN of the /24
    for (let i = 1; i < 255; i++) {
      candidates.push(`${parts[0]}.${parts[1]}.${parts[2]}.${i}`);
    }
    return candidates;
  }

  if (mask >= 24) {
    [1, 5, 10, 25, 42, 69, 100, 150, 200, 254].forEach((n) =>
      candidates.push(`${parts[0]}.${parts[1]}.${parts[2]}.${n}`),
    );
  } else if (mask >= 16) {
    const count = aggressive ? 30 : 15;
    const subBlocks = Array.from({ length: count }, () =>
      Math.floor(Math.random() * 256),
    );
    subBlocks.forEach((b) => {
      [10, 100, 200].forEach((n) =>
        candidates.push(`${parts[0]}.${parts[1]}.${b}.${n}`),
      );
    });
  } else {
    const count = aggressive ? 100 : 40;
    for (let i = 0; i < count; i++) {
      const b2 = Math.floor(Math.random() * Math.pow(2, 24 - mask));
      const b3 = Math.floor(Math.random() * 256);
      const b4 = [1, 10, 42, 100, 200, 254][Math.floor(Math.random() * 6)];
      candidates.push(
        `${parts[0]}.${parts[1] + (mask < 16 ? b2 : 0)}.${b3}.${b4}`,
      );
    }
  }

  return Array.from(new Set(candidates));
}

async function main() {
  const arg = process.argv[2]?.toUpperCase();
  const aggressive = process.argv.includes("--aggressive");

  let providersToScan = Object.entries(VENEZUELA_ISPS);

  if (arg && arg !== "--AGGRESSIVE") {
    if (VENEZUELA_ISPS[arg]) {
      providersToScan = [[arg, VENEZUELA_ISPS[arg]]];
      console.log(
        `--- Starting PROVIDER-SPECIFIC Discovery: ${arg} ${aggressive ? "(AGGRESSIVE)" : ""} ---`,
      );
    } else {
      console.error(
        `Error: Provider "${arg}" not found in constants/providers.ts`,
      );
      process.exit(1);
    }
  } else {
    console.log(
      `--- Starting OMNI-DISCOVERY ${aggressive ? "(AGGRESSIVE)" : ""} ---`,
    );
  }

  for (const [key, providerInfo] of providersToScan) {
    const { asn, name: providerName } = providerInfo;
    console.log(`\n[${providerName}] Searching AS${asn}...`);
    const prefixes = await getPrefixes(asn).then((p) =>
      p.sort(() => 0.5 - Math.random()),
    );

    for (let i = 0; i < prefixes.length; i++) {
      const prefix = prefixes[i];

      if (await isPrefixScanned(prefix)) {
        if (i % 20 === 0) process.stdout.write(".");
        continue;
      }

      const candidates = getCandidates(prefix, aggressive);
      process.stdout.write(
        `\n  Prefix ${i + 1}/${prefixes.length} (${prefix}): Checking ${candidates.length} IPs... `,
      );

      const aliveResults = [];
      const CHUNK_SIZE = 25;
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
        process.stdout.write(`Found ${aliveIps.length} alive. Geolocating... `);
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
            if (saved) {
              process.stdout.write(`[${geo.regionName}] `);
              savedCount++;
            }
          }
        }
        if (savedCount === 0) process.stdout.write("Filtered (No VE).");
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        process.stdout.write("None.");
      }

      await markPrefixAsScanned(prefix, providerName, asn);
    }
  }
}

main();
