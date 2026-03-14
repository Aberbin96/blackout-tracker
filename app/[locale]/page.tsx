import { Header } from "@/components/Header";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import {
  DashboardStatsFetcher,
  DashboardStatsSkeleton,
} from "@/components/fetchers/DashboardStatsFetcher";
import {
  RegionalTableFetcher,
  RegionalTableSkeleton,
} from "@/components/fetchers/RegionalTableFetcher";
import {
  NodeCompositionFetcher,
  NodeCompositionSkeleton,
} from "@/components/fetchers/NodeCompositionFetcher";
import {
  HistoricalChartsFetcher,
  HistoricalChartsSkeleton,
} from "@/components/fetchers/HistoricalChartsFetcher";
import { MapFetcher } from "@/components/fetchers/MapFetcher";
import {
  SidebarFetcher,
  SidebarSkeleton,
} from "@/components/fetchers/SidebarFetcher";
import { MapLoader } from "@/components/MapLoader";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function Home({ params, searchParams }: PageProps) {
  return (
    <div className="bg-background text-foreground h-[100dvh] flex flex-col font-display selection:bg-accent selection:text-white">
      <Suspense fallback={<div className="h-20 border-b border-slate-200" />}>
        <HeaderWithLocale params={params} />
      </Suspense>
      <div className="flex flex-1 overflow-hidden relative">
        {/* Decorative background glow */}
        <div className="absolute top-[-10%] right-[-10%] size-[500px] bg-secondary/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] left-[-10%] size-[500px] bg-accent/5 blur-[120px] rounded-full pointer-events-none z-0"></div>

        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarFetcher />
        </Suspense>

        <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 relative z-10 custom-scrollbar">
          {/* Stats Overview */}
          <Suspense fallback={<DashboardStatsSkeleton />}>
            <DashboardStatsFetcher searchParams={searchParams} />
          </Suspense>

          {/* Map View */}
          <Suspense fallback={<MapLoader />}>
            <MapFetcher searchParams={searchParams} />
          </Suspense>

          {/* Middle Section: Regional Status & Node Composition */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Suspense fallback={<RegionalTableSkeleton />}>
              <RegionalTableFetcher searchParams={searchParams} />
            </Suspense>
            <Suspense fallback={<NodeCompositionSkeleton />}>
              <NodeCompositionFetcher searchParams={searchParams} />
            </Suspense>
          </div>

          {/* Historical Analytics Section */}
          <Suspense fallback={<HistoricalChartsSkeleton />}>
            <HistoricalChartsFetcher searchParams={searchParams} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

async function HeaderWithLocale({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Header />;
}
