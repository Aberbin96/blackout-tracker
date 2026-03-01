"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

interface NodeData {
  ip: string;
  lat: number;
  lon: number;
  provider: string;
  location: string;
  status: string;
}

interface MapViewProps {
  data: NodeData[];
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 400);
  }, [map]);
  return null;
}

export default function MapView({ data }: MapViewProps) {
  const t = useTranslations("Dashboard");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted)
    return (
      <div className="h-[400px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
    );

  const venezuelaCenter: [number, number] = [7.0, -66.0];

  return (
    <div className="glass-card overflow-hidden h-[450px] relative z-0">
      <div className="absolute top-4 left-12 z-[1000] glass-card p-4 shadow-2xl pointer-events-none border-secondary/20">
        <h3 className="text-xs font-black text-secondary dark:text-accent uppercase tracking-[0.2em]">
          {t("map.title")}
        </h3>
        <div className="flex items-center gap-2 mt-2">
          <div className="size-1.5 rounded-full bg-success animate-pulse"></div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">
            {data.length} {t("map.detected")}
          </p>
        </div>
      </div>

      <MapContainer
        center={venezuelaCenter}
        zoom={6}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizer />

        {data.map((node, idx) => (
          <CircleMarker
            key={`${node.ip}-${idx}`}
            center={[node.lat, node.lon]}
            radius={node.status === "online" ? 5 : 4}
            pathOptions={{
              fillColor: node.status === "online" ? "#10b981" : "#ef4444",
              color: "#ffffff",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div className="p-1">
                <p className="font-bold text-xs mb-1">{node.provider}</p>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`size-2 rounded-full ${node.status === "online" ? "bg-success" : "bg-danger"}`}
                  ></div>
                  <span className="text-[10px] font-bold uppercase">
                    {t(
                      `status.${node.status === "online" ? "operational" : "outage"}`,
                    )}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">{node.location}</p>
                <p className="text-[10px] text-primary mt-1">{node.ip}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
