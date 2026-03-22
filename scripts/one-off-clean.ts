import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import net from "net";

const execAsync = promisify(exec);
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing keys");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function pingIp(ip: string, timeoutMs: number): Promise<boolean> {
  try {
    const platform = process.platform;
    const cmd = platform === "win32"
      ? `ping -n 1 -w ${timeoutMs} ${ip}`
      : `ping -c 1 -W ${Math.ceil(timeoutMs / 1000)} ${ip}`;
    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
}

async function performCheck(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.connect(port, ip, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("close", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function fastCheck(ip: string): Promise<boolean> {
  const portsToTry = [80, 443, 8291, 8080];
  const results = await Promise.all([
    pingIp(ip, 3000),
    ...portsToTry.map(p => performCheck(ip, p, 3000))
  ]);
  return results.some(r => r === true);
}

async function main() {
  console.log("Fetching all nodes with score >= 10...");
  
  let allTargets: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  while(hasMore) {
    const { data } = await supabase
      .from("monitoring_targets")
      .select("id, ip, stability_score")
      .gte("stability_score", 10)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
    if (data && data.length > 0) {
      allTargets.push(...data);
      page++;
      if (data.length < PAGE_SIZE) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${allTargets.length} nodes to aggressively clean.`);
  let deadNodes = [];
  let aliveNodes = [];

  const BATCH_SIZE = 50;
  for (let i = 0; i < allTargets.length; i += BATCH_SIZE) {
    const batch = allTargets.slice(i, i + BATCH_SIZE);
    
    const checks = await Promise.all(batch.map(async (t) => {
      const isOnline = await fastCheck(t.ip);
      return { id: t.id, ip: t.ip, isOnline };
    }));

    const batchDead = checks.filter(c => !c.isOnline).map(c => c.ip);
    const batchAlive = checks.filter(c => c.isOnline).map(c => c.ip);
    
    deadNodes.push(...batchDead);
    aliveNodes.push(...batchAlive);

    console.log(`Processed ${i + batch.length}/${allTargets.length} | Dead in batch: ${batchDead.length}`);
    
    // Hard reset immediately to free RAM
    if (batchDead.length > 0) {
      await supabase.from("monitoring_targets")
        .update({ stability_score: 0 })
        .in("ip", batchDead);
    }
  }

  console.log(`--- CLEANUP FINISHED ---`);
  console.log(`Alive: ${aliveNodes.length}`);
  console.log(`Dead (Reset to 0): ${deadNodes.length}`);
}

main();
