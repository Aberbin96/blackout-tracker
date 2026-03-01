import axios from "axios";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

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

  // 1. SSL Certificate Check (Port 443)
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

  // 2. HTTP Title Check
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
    } catch (e) {
      /* ignore */
    }
  }

  return metadata;
}

async function main() {
  console.log("--- Starting Deep Service Enrichment ---");

  // Fetch targets that have web ports open and lack enrichment metadata
  // We can also just fetch all and re-process
  const { data: targets, error } = await supabase
    .from("monitoring_targets")
    .select("id, ip, services, metadata")
    .is("is_active", true);

  if (error || !targets) {
    console.error("Error fetching targets:", error);
    return;
  }

  console.log(`Found ${targets.length} targets to process.`);

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const ports = target.services || [];

    // We only care about IPs with web ports
    const webPort = ports.find((p: number) =>
      [80, 443, 8080, 8081, 8888].includes(p),
    );

    if (!webPort) continue;

    process.stdout.write(
      `[${i + 1}/${targets.length}] Enriching ${target.ip}... `,
    );

    const newMetadata = await getServiceMetadata(target.ip, webPort);

    if (Object.keys(newMetadata).length > 0) {
      const { error: updateError } = await supabase
        .from("monitoring_targets")
        .update({ metadata: { ...target.metadata, ...newMetadata } })
        .eq("id", target.id);

      if (updateError) {
        process.stdout.write(`Error: ${updateError.message}\n`);
      } else {
        process.stdout.write("Done.\n");
      }
    } else {
      process.stdout.write("No metadata found.\n");
    }
  }

  console.log("\nEnrichment complete.");
}

main();
