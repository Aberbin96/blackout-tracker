import { spawn } from "child_process";
import { VENEZUELA_ISPS } from "../constants/providers";

/**
 * Runner to launch discovery for all providers in parallel
 * Options: --aggressive, --loop
 */
const providers = Object.keys(VENEZUELA_ISPS);
const isAggressive = process.argv.includes("--aggressive");
const isLoop = process.argv.includes("--loop");

// Order providers roughly by size (smallest to largest) to get quick wins first
const sortedProviders = providers.sort((a, b) => {
  const hugeProviders = ["CANTV", "INTER", "NETUNO"];
  const isAHuge = hugeProviders.includes(a);
  const isBHuge = hugeProviders.includes(b);

  if (isAHuge && !isBHuge) return 1;
  if (!isAHuge && isBHuge) return -1;
  return 0; // Keep original order for others
});

async function runDiscovery() {
  console.log(
    `\n--- Launching Discovery Cycle ${new Date().toLocaleString()} ---`,
  );
  console.log(`Settings: Aggressive=${isAggressive}, Loop=${isLoop}`);
  console.log(`Provider Order: ${sortedProviders.join(", ")}`);

  for (const provider of sortedProviders) {
    console.log(`\n[Launcher] --- Starting worker for ${provider} ---`);

    const args = ["tsx", "scripts/discover-ips.ts", provider];
    if (isAggressive) args.push("--aggressive");

    await new Promise((resolve) => {
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
  }

  console.log(`--- Cycle Finished at ${new Date().toLocaleString()} ---`);

  if (isLoop) {
    console.log("Waiting 30 seconds before next cycle...");
    setTimeout(runDiscovery, 30000);
  }
}

runDiscovery();
