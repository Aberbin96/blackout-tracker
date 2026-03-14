import { getRegionalStats } from "@/services/stats";
import { RegionalTable } from "../RegionalTable";

export async function RegionalTableFetcher({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : undefined;
  const provider =
    typeof params.provider === "string" ? params.provider : undefined;

  const data = await getRegionalStats(state, provider);
  return <RegionalTable data={data} />;
}

export function RegionalTableSkeleton() {
  return <div className="glass-card h-96 w-full animate-pulse bg-slate-100/50 dark:bg-slate-800/50" />;
}
