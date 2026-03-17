import axios from "axios";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import dns from "dns/promises";
import net from "net";
import { classifyDevice, detectNetworkType } from "../utils/classifier";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase credentials not found in .env.local");
  process.exit(1);
}

// If using service role key, we bypass RLS correctly
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Simple TCP port check
 */
async function checkIpPort(ip: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.connect(port, ip, () => {
      socket.destroy();
      resolve(true);
    });

    const fail = () => {
      socket.destroy();
      resolve(false);
    };

    socket.on("error", fail);
    socket.on("timeout", fail);
    socket.on("close", fail);
  });
}

/**
 * Target Enrichment Tool
 * Processes existing targets in DB to extract HTTP titles and SSL domains.
 */

async function getServiceMetadata(ip: string, port: number): Promise<any> {
  const metadata: any = {};

  // 1. Reverse DNS (PTR) Lookup
  try {
    const hostnames = await dns.reverse(ip);
    if (hostnames && hostnames.length > 0) {
      metadata.ptr_record = hostnames[0];
    }
  } catch (e) {
    /* ignore if it has no PTR record */
  }

  // 2. SSL Certificate Check (Port 443)
  if (port === 443) {
    try {
      const tls = await import("tls");
      const result = await new Promise((resolve) => {
        const socket = tls.connect(
          443,
          ip,
          {
            servername: ip,
            rejectUnauthorized: false,
            timeout: 3000,
          },
          () => {
            const cert = socket.getPeerCertificate();
            const data: any = {};
            if (cert && cert.subject) {
              data.ssl_subject = cert.subject.CN;
              data.ssl_issuer = cert.issuer?.O;
            }
            socket.end();
            resolve(data);
          },
        );
        socket.on("error", () => resolve({}));
        socket.on("timeout", () => {
          socket.destroy();
          resolve({});
        });
      });
      Object.assign(metadata, result);
    } catch (e) {
      /* ignore */
    }
  }

  // 3. HTTP Title & Auth Check
  if ([80, 443, 8080, 8081, 8888].includes(port)) {
    try {
      const protocol = port === 443 ? "https" : "http";
      const resp = await axios.get(`${protocol}://${ip}:${port}`, {
        timeout: 3500,
        validateStatus: () => true,
      });
      const titleMatch = resp.data.toString().match(/<title>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        metadata.http_title = titleMatch[1].trim();
      }
      if (resp.headers.server) {
        metadata.http_server = resp.headers.server;
      }
      if (resp.headers["www-authenticate"]) {
        metadata.http_auth = resp.headers["www-authenticate"];
      }
    } catch (e) {
      /* ignore */
    }
  }

  return metadata;
}

async function processTarget(target: any, index: number, total: number) {
  const currentServices = target.services || [80];
  const primaryPort = currentServices[0];
  
  // 1. Port Discovery & Promotion
  let workingPort = primaryPort;
  let needsPromotion = false;

  // Check if primary port is actually open
  const isPrimaryOpen = await checkIpPort(target.ip, primaryPort);
  
  if (!isPrimaryOpen) {
    // If primary is closed, try fallback ports (Smart Learning)
    const fallbackPorts = [443, 8291, 22, 21, 53, 3389, 7547, 8080, 8443].filter(p => p !== primaryPort);
    
    for (const port of fallbackPorts.slice(0, 5)) { // Try up to 5 common ports
      const isPortOpen = await checkIpPort(target.ip, port, 2000);
      if (isPortOpen) {
        workingPort = port;
        needsPromotion = true;
        break;
      }
    }
  }

  // 2. Metadata Extraction (using the working port)
  const networkType = detectNetworkType(
    target.provider,
    target.asn,
    target.classification_metadata?.mobile || false,
  );

  const isWebPort = [80, 443, 8080, 8081, 8888].includes(workingPort);

  let combinedMetadata = { ...target.classification_metadata };
  if (isWebPort) {
    const newMetadata = await getServiceMetadata(target.ip, workingPort);
    combinedMetadata = { ...combinedMetadata, ...newMetadata };
  }

  // 3. Device Type Classification
  const deviceType = classifyDevice(combinedMetadata);

  // 4. Update Database
  const updateData: any = {
    classification_metadata: combinedMetadata,
    device_type: deviceType,
    network_type: networkType,
    is_mobile: networkType === "mobile",
  };

  if (needsPromotion) {
    updateData.services = [
      workingPort,
      ...currentServices.filter((p: number) => p !== workingPort),
    ];
    console.log(`[Promotion] ${target.ip}: ${primaryPort} -> ${workingPort}`);
  }

  const { error: updateError } = await supabase
    .from("monitoring_targets")
    .update(updateData)
    .eq("id", target.id);

  if (updateError) {
    console.log(`[${index + 1}/${total}] Error updating ${target.ip}: ${updateError.message}`);
  } else {
    const promotionLabel = needsPromotion ? ` (PROMOTED ${workingPort})` : "";
    console.log(`[${index + 1}/${total}] Processed ${target.ip} (${networkType}/${deviceType})${promotionLabel}`);
  }
}

async function main() {
  console.log("--- Starting Optimized Deep Service Enrichment ---");

  const BATCH_SIZE = 1000;
  const CONCURRENCY = 50;
  let offset = 0;
  let totalProcessed = 0;

  while (true) {
    console.log(`Fetching batch: ${offset} - ${offset + BATCH_SIZE}...`);
    
    const { data: targets, error } = await supabase
      .from("monitoring_targets")
      .select("id, ip, services, classification_metadata, provider, asn")
      .is("is_active", true)
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Error fetching targets:", error);
      break;
    }

    if (!targets || targets.length === 0) {
      console.log("No more targets to process.");
      break;
    }

    console.log(`Processing batch of ${targets.length} targets with concurrency ${CONCURRENCY}...`);

    // Process batch with concurrency control
    const chunks = [];
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      chunks.push(targets.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map((target, idx) => 
        processTarget(target, offset + totalProcessed + idx, offset + targets.length)
      ));
      totalProcessed += chunk.length;
    }

    if (targets.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
    totalProcessed = 0; // Reset for next batch log clarity
  }

  console.log("\nEnrichment and Classification complete.");
}

main();
