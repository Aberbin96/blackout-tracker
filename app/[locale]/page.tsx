import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { DashboardStats } from "@/components/DashboardStats";
import { RegionalTable } from "@/components/RegionalTable";
import { NodeComposition } from "@/components/NodeComposition";
import { HistoricalCharts } from "@/components/HistoricalCharts";
import { MapWrapper } from "@/components/MapWrapper";
import {
  getDashboardStats,
  getRegionalStats,
  getNodeComposition,
  getMapData,
  getFiltersData,
  getHistoricalStats,
  getActiveBlackouts,
} from "@/services/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeState =
    typeof params.state === "string" ? params.state : undefined;
  const activeProvider =
    typeof params.provider === "string" ? params.provider : undefined;

  const [
    stats,
    regionalData,
    nodeComposition,
    mapData,
    filters,
    historicalStats,
    blackouts,
  ] = await Promise.all([
    getDashboardStats(activeState, activeProvider),
    getRegionalStats(activeState, activeProvider),
    getNodeComposition(activeState, activeProvider),
    getMapData(activeState, activeProvider),
    getFiltersData(),
    getHistoricalStats(activeState, activeProvider),
    getActiveBlackouts(),
  ]);

  return (
    <div className="bg-background text-foreground h-[100dvh] flex flex-col font-display selection:bg-accent selection:text-white">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Decorative background glow */}
        <div className="absolute top-[-10%] right-[-10%] size-[500px] bg-secondary/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] left-[-10%] size-[500px] bg-accent/5 blur-[120px] rounded-full pointer-events-none z-0"></div>

        <Sidebar
          states={filters.states}
          providers={filters.providers}
          activeBlackouts={blackouts}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 relative z-10 custom-scrollbar">
          {/* Stats Overview */}
          <DashboardStats
            availability={stats.availability}
            activeSensors={stats.activeSensors}
            onlineSensors={stats.onlineSensors}
            avgLatency={stats.avgLatency}
            trend={stats.trend}
          />

          {/* Map View */}
          <MapWrapper data={mapData} />

          {/* Middle Section: Regional Status & Node Composition */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RegionalTable data={regionalData} />
            <NodeComposition data={nodeComposition} />
          </div>

          {/* Historical Analytics Section */}
          <HistoricalCharts
            dailyData={historicalStats.daily}
            hourlyData={historicalStats.hourly}
          />
        </main>
      </div>
    </div>
  );
}
