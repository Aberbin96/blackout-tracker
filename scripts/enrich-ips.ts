import axios from "axios";
import path from "path";
import dotenv from "dotenv";
import dns from "dns/promises";
import net from "net";
import { classifyDevice, detectNetworkType } from "../utils/classifier";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { monitoringTargets } from "../db/schema";
import { asc, eq } from "drizzle-orm";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL not found in .env.local");
  process.exit(1);
}

const pool = mysql.createPool(DATABASE_URL);
const db = drizzle(pool, { mode: "default" });

async function checkIpPort(ip: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.connect(port, ip, () => { socket.destroy(); resolve(true); });
    const fail = () => { socket.destroy(); resolve(false); };
    socket.on("error", fail);
    socket.on("timeout", fail);
    socket.on("close", fail);
  });
}

async function getServiceMetadata(ip: string, port: number): Promise<any> {
  const metadata: any = {};

  try {
    const hostnames = await dns.reverse(ip);
    if (hostnames?.length > 0) metadata.ptr_record = hostnames[0];
  } catch { /* ignore */ }

  if (port === 443) {
    try {
      const tls = await import("tls");
      const result = await new Promise((resolve) => {
        const socket = tls.connect(443, ip, { servername: ip, rejectUnauthorized: false, timeout: 3000 }, () => {
          const cert = socket.getPeerCertificate();
          const data: any = {};
          if (cert?.subject) { data.ssl_subject = cert.subject.CN; data.ssl_issuer = cert.issuer?.O; }
          socket.end();
          resolve(data);
        });
        socket.on("error", () => resolve({}));
        socket.on("timeout", () => { socket.destroy(); resolve({}); });
      });
      Object.assign(metadata, result);
    } catch { /* ignore */ }
  }

  if ([80, 443, 8080, 8081, 8888].includes(port)) {
    try {
      const protocol = port === 443 ? "https" : "http";
      const resp = await axios.get(`${protocol}://${ip}:${port}`, { timeout: 3500, validateStatus: () => true });
      const titleMatch = resp.data.toString().match(/<title>(.*?)<\/title>/i);
      if (titleMatch?.[1]) metadata.http_title = titleMatch[1].trim();
      if (resp.headers.server) metadata.http_server = resp.headers.server;
      if (resp.headers["www-authenticate"]) metadata.http_auth = resp.headers["www-authenticate"];
    } catch { /* ignore */ }
  }

  return metadata;
}

async function processTarget(target: any, index: number, total: number) {
  const currentServices: number[] = Array.isArray(target.services)
    ? target.services
    : (target.services ? JSON.parse(target.services) : [80]);
  const primaryPort = currentServices[0] || 80;

  let workingPort = primaryPort;
  let needsPromotion = false;

  const isPrimaryOpen = await checkIpPort(target.ip, primaryPort);
  if (!isPrimaryOpen) {
    const fallbackPorts = [443, 8291, 22, 21, 53, 3389, 7547, 8080, 8443].filter((p) => p !== primaryPort);
    for (const port of fallbackPorts.slice(0, 5)) {
      if (await checkIpPort(target.ip, port, 2000)) {
        workingPort = port;
        needsPromotion = true;
        break;
      }
    }
  }

  const networkType = detectNetworkType(target.provider, target.asn, target.classificationMetadata?.mobile || false);
  const isWebPort = [80, 443, 8080, 8081, 8888].includes(workingPort);
  let combinedMetadata = { ...target.classificationMetadata };
  if (isWebPort) {
    const newMetadata = await getServiceMetadata(target.ip, workingPort);
    combinedMetadata = { ...combinedMetadata, ...newMetadata };
  }

  const deviceType = classifyDevice(combinedMetadata);

  const updateData: any = {
    classificationMetadata: combinedMetadata,
    deviceType,
    networkType,
    isMobile: networkType === "mobile",
  };

  if (needsPromotion) {
    updateData.services = JSON.stringify([workingPort, ...currentServices.filter((p) => p !== workingPort)]);
    console.log(`[Promotion] ${target.ip}: ${primaryPort} -> ${workingPort}`);
  }

  try {
    await db.update(monitoringTargets).set(updateData).where(eq(monitoringTargets.id, target.id));
    const promotionLabel = needsPromotion ? ` (PROMOTED ${workingPort})` : "";
    console.log(`[${index + 1}/${total}] Processed ${target.ip} (${networkType}/${deviceType})${promotionLabel}`);
  } catch (err: any) {
    console.log(`[${index + 1}/${total}] Error updating ${target.ip}: ${err.message}`);
  }
}

async function main() {
  console.log("--- Starting Optimized Deep Service Enrichment ---");

  const BATCH_SIZE = 1000;
  const CONCURRENCY = 50;
  let offset = 0;

  while (true) {
    console.log(`Fetching batch: ${offset} - ${offset + BATCH_SIZE}...`);

    const targets = await db
      .select({
        id: monitoringTargets.id,
        ip: monitoringTargets.ip,
        services: monitoringTargets.services,
        classificationMetadata: monitoringTargets.classificationMetadata,
        provider: monitoringTargets.provider,
        asn: monitoringTargets.asn,
      })
      .from(monitoringTargets)
      .where(eq(monitoringTargets.isActive, true))
      .orderBy(asc(monitoringTargets.id))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (!targets || targets.length === 0) {
      console.log("No more targets to process.");
      break;
    }

    console.log(`Processing batch of ${targets.length} targets with concurrency ${CONCURRENCY}...`);

    const chunks: typeof targets[] = [];
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      chunks.push(targets.slice(i, i + CONCURRENCY));
    }

    let processed = 0;
    for (const chunk of chunks) {
      await Promise.all(chunk.map((target, idx) => processTarget(target, offset + processed + idx, offset + targets.length)));
      processed += chunk.length;
    }

    if (targets.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log("\nEnrichment and Classification complete.");
  await pool.end();
}

main();
