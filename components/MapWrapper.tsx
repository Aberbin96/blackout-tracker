"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
  ),
});

export function MapWrapper({ data }: { data: any[] }) {
  return <MapView data={data} />;
}
