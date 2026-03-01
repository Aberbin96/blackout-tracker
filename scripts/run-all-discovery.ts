import { spawn } from "child_process";
import { VENEZUELA_ISPS } from "../constants/providers";

/**
 * Runner to launch discovery for all providers in parallel
 * Options: --aggressive, --loop
 */
const providers = Object.keys(VENEZUELA_ISPS);
const isAggressive = process.argv.includes("--aggressive");
const isLoop = process.argv.includes("--loop");

async function runDiscovery() {
  console.log(
    `\n--- Launching Discovery Cycle ${new Date().toLocaleString()} ---`,
  );
  console.log(`Settings: Aggressive=${isAggressive}, Loop=${isLoop}`);

  const tasks = providers.map((provider) => {
    return new Promise((resolve) => {
      console.log(`[Launcher] Starting worker for ${provider}...`);

      const args = ["tsx", "scripts/discover-ips.ts", provider];
      if (isAggressive) args.push("--aggressive");

      const worker = spawn("npx", args, {
        stdio: "inherit",
        shell: true,
      });

      worker.on("close", (code) => {
        console.log(
          `[Launcher] Worker for ${provider} exited with code ${code}`,
        );
        resolve(code);
      });

      worker.on("error", (err) => {
        console.error(
          `[Launcher] Failed to start worker for ${provider}:`,
          err.message,
        );
        resolve(1);
      });
    });
  });

  await Promise.all(tasks);
  console.log(`--- Cycle Finished at ${new Date().toLocaleString()} ---`);

  if (isLoop) {
    console.log("Waiting 30 seconds before next cycle...");
    setTimeout(runDiscovery, 30000);
  }
}

runDiscovery();
