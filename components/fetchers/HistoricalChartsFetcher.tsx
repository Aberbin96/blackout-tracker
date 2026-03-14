import { getHistoricalStats } from "@/services/stats";
import { HistoricalChartsWrapper as HistoricalCharts } from "../wrappers/HistoricalChartsWrapper";

export async function HistoricalChartsFetcher({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : undefined;
  const provider =
    typeof params.provider === "string" ? params.provider : undefined;

  const stats = await getHistoricalStats(state, provider);
  return (
    <HistoricalCharts
      dailyData={stats.daily}
      hourlyData={stats.hourly}
    />
  );
}

export function HistoricalChartsSkeleton() {
  return <div className="glass-card h-80 w-full animate-pulse bg-slate-100/50 dark:bg-slate-800/50" />;
}
