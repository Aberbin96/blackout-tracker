import axios from "axios";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import dns from "dns/promises";
import { classifyDevice, detectNetworkType } from "../utils/classifier";

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

async function main() {
  console.log("--- Starting Deep Service Enrichment & Classification ---");

  // Fetch all active targets
  const { data: targets, error } = await supabase
    .from("monitoring_targets")
    .select("id, ip, services, classification_metadata, provider, asn")
    .is("is_active", true);

  if (error || !targets) {
    console.error("Error fetching targets:", error);
    return;
  }

  console.log(`Found ${targets.length} targets to process.`);

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const ports = target.services || [];

    // 1. Basic Classification (ASN/Provider based)
    const networkType = detectNetworkType(
      target.provider,
      target.asn,
      target.classification_metadata?.mobile || false,
    );

    // 2. Deep Enrichment (Web Ports)
    const webPort = ports.find((p: number) =>
      [80, 443, 8080, 8081, 8888].includes(p),
    );

    let combinedMetadata = { ...target.classification_metadata };
    if (webPort) {
      process.stdout.write(
        `[${i + 1}/${targets.length}] Deep enriching ${target.ip}... `,
      );
      const newMetadata = await getServiceMetadata(target.ip, webPort);
      combinedMetadata = { ...combinedMetadata, ...newMetadata };
    } else {
      process.stdout.write(
        `[${i + 1}/${targets.length}] Quick classifying ${target.ip}... `,
      );
    }

    // 3. Device Type Classification
    const deviceType = classifyDevice(combinedMetadata);

    const { error: updateError } = await supabase
      .from("monitoring_targets")
      .update({
        classification_metadata: combinedMetadata,
        device_type: deviceType,
        network_type: networkType,
        is_mobile: networkType === "mobile",
      })
      .eq("id", target.id);

    if (updateError) {
      process.stdout.write(`Error: ${updateError.message}\n`);
    } else {
      process.stdout.write(`Done (${networkType}/${deviceType}).\n`);
    }

    // Delay to avoid overwhelming
    if (webPort) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log("\nEnrichment and Classification complete.");
}

main();
