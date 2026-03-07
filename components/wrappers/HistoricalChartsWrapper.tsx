"use client";

import nextDynamic from "next/dynamic";
import { type ComponentProps } from "react";

const HistoricalCharts = nextDynamic(
  () =>
    import("@/components/HistoricalCharts").then((mod) => mod.HistoricalCharts),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
    ),
  },
);

type HistoricalChartsProps = ComponentProps<
  typeof import("@/components/HistoricalCharts").HistoricalCharts
>;

export function HistoricalChartsWrapper(props: HistoricalChartsProps) {
  return <HistoricalCharts {...props} />;
}
