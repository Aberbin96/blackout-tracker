import { getDashboardStats } from "@/services/stats";
import { DashboardStats } from "../DashboardStats";

export async function DashboardStatsFetcher({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : undefined;
  const provider =
    typeof params.provider === "string" ? params.provider : undefined;

  const stats = await getDashboardStats(state, provider);
  return (
    <DashboardStats
      availability={stats.availability}
      activeSensors={stats.activeSensors}
      onlineSensors={stats.onlineSensors}
      avgLatency={stats.avgLatency}
      trend={stats.trend}
    />
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-card p-6 h-32 bg-slate-100/50 dark:bg-slate-800/50" />
      ))}
    </div>
  );
}
