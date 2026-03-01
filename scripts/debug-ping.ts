import { supabase } from "../utils/supabase";
import net from "net";

async function testConnections() {
  const { data: targets, error } = await supabase
    .from("monitoring_targets")
    .select("*")
    .eq("is_active", true)
    .limit(10);

  if (error || !targets) {
    console.error("Error fetching targets:", error);
    return;
  }

  console.log(`Testing ${targets.length} targets...`);

  for (const target of targets) {
    const port = target.services?.[0] || 80;
    console.log(
      `\nTesting IP: ${target.ip} on Port: ${port} (Provider: ${target.provider})`,
    );

    const result = await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3500);
      const start = Date.now();

      socket.connect(port, target.ip, () => {
        socket.destroy();
        resolve({ status: "online", time: Date.now() - start });
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve({ status: "error", msg: err.message });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({ status: "timeout" });
      });
    });

    console.log(`Result:`, result);
  }
}

testConnections();
