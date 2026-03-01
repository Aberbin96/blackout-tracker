import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

/**
 * IP Enrichment Script
 *
 * This script takes the existing caracas.json and uses Censys Lookup
 * to find the actual open ports for each IP, updating the 'services' field.
 */

const CENSYS_PAT = process.env.CENSYS_PAT;
const DATA_PATH = path.join(process.cwd(), "data/targets/caracas.json");

async function lookupIpPorts(ip: string): Promise<number[]> {
  try {
    const response = await axios.get(
      `https://api.platform.censys.io/v3/global/asset/host/${ip}`,
      {
        headers: {
          Authorization: `Bearer ${CENSYS_PAT}`,
          Accept: "application/json",
        },
        timeout: 5000,
      },
    );
    const services = response.data.result.resource.services || [];
    return services.map((s: any) => s.port);
  } catch (error: any) {
    // If 404, the IP might not be in Censys or is totally offline
    return [];
  }
}

async function main() {
  if (!CENSYS_PAT) {
    console.error("Error: CENSYS_PAT is required in .env.local");
    process.exit(1);
  }

  const targets = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  console.log(`Enriching ${targets.length} IPs...`);

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`[${i + 1}/${targets.length}] Looking up ${target.ip}...`);

    const ports = await lookupIpPorts(target.ip);
    if (ports.length > 0) {
      target.services = ports;
      console.log(`  -> Found ports: ${ports.join(", ")}`);
    } else {
      console.log(`  -> No active ports found in Censys.`);
    }

    // Rate limiting to respect Censys API quota
    await new Promise((r) => setTimeout(r, 200));
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(targets, null, 2));
  console.log(`Update complete! Check results with the API again.`);
}

main();
