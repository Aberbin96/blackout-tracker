import { supabase } from "../utils/supabase";

/**
 * Normalizes state names by removing accents and converting to lowercase.
 */
const normalizeStateName = (name: string): string => {
  if (!name) return "desconocido";

  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

async function cleanup() {
  console.log("--- Starting State Name Cleanup ---");

  // 1. Cleanup monitoring_targets
  const { data: targets, error: targetError } = await supabase
    .from("monitoring_targets")
    .select("id, state");

  if (targetError) {
    console.error("Error fetching targets:", targetError);
    return;
  }

  console.log(`Checking ${targets.length} targets...`);
  let updatedTargets = 0;
  for (const target of targets) {
    const normalized = normalizeStateName(target.state);
    if (normalized !== target.state) {
      const { error } = await supabase
        .from("monitoring_targets")
        .update({ state: normalized })
        .eq("id", target.id);

      if (error) {
        console.error(`Error updating target ${target.id}:`, error.message);
      } else {
        updatedTargets++;
      }
    }
  }
  console.log(`Updated ${updatedTargets} targets.`);

  // 2. Cleanup connectivity_checks
  const { data: checks, error: checkError } = await supabase
    .from("connectivity_checks")
    .select("id, state");

  if (checkError) {
    console.error("Error fetching checks:", checkError);
    return;
  }

  console.log(`Checking ${checks.length} checks...`);
  let updatedChecks = 0;
  for (const check of checks) {
    const normalized = normalizeStateName(check.state);
    if (normalized !== check.state) {
      const { error } = await supabase
        .from("connectivity_checks")
        .update({ state: normalized })
        .eq("id", check.id);

      if (error) {
        console.error(`Error updating check ${check.id}:`, error.message);
      } else {
        updatedChecks++;
      }
    }
  }
  console.log(`Updated ${updatedChecks} checks.`);

  console.log("--- Cleanup Complete ---");
}

cleanup();
