"use client";

import dynamic from "next/dynamic";
import { MapLoader } from "./MapLoader";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <MapLoader />,
});

export function MapWrapper({ data }: { data: any[] }) {
  return <MapView data={data} />;
}
