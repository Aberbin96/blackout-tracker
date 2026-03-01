"use client";

import { useTranslations } from "next-intl";
import { Icon } from "./atoms/Icon";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

interface ChartData {
  name?: string;
  time?: string;
  uptime: number;
}

interface HistoricalChartsProps {
  dailyData: ChartData[];
  hourlyData: ChartData[];
}

export function HistoricalCharts({
  dailyData,
  hourlyData,
}: HistoricalChartsProps) {
  const t = useTranslations("Dashboard");
  // Fallback mock data if DB is empty
  const defaultDaily = [
    { name: "MON", uptime: 90 },
    { name: "TUE", uptime: 85 },
    { name: "WED", uptime: 40 },
    { name: "THU", uptime: 60 },
    { name: "FRI", uptime: 95 },
    { name: "SAT", uptime: 92 },
    { name: "SUN", uptime: 70 },
  ];

  const displayDaily = dailyData.length > 0 ? dailyData : defaultDaily;
  const displayHourly = hourlyData.length > 0 ? hourlyData : [];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-primary dark:text-slate-200">
          {t("charts.title")}
        </h3>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-primary/10 rounded text-xs font-bold text-primary">
            24H
          </button>
          <button className="px-3 py-1 bg-primary rounded text-xs font-bold text-white shadow-lg">
            7D
          </button>
          <button className="px-3 py-1 bg-primary/10 rounded text-xs font-bold text-primary">
            30D
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Chart 1: Daily Availability */}
        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {t("charts.uptimeDay")}
            </h4>
            <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
              <Icon name="query_stats" className="text-lg" />
            </div>
          </div>

          <div className="h-64 w-full min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayDaily}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontWeight: 900, fill: "#94A3B8" }}
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: "rgba(67, 56, 202, 0.05)" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "var(--glass-shadow)",
                    background: "var(--glass-bg)",
                    backdropFilter: "blur(12px)",
                  }}
                />
                <Bar
                  dataKey="uptime"
                  radius={[4, 4, 0, 0]}
                  fill="#4338ca"
                ></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex justify-center gap-6">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-primary"></div>
              <span className="text-xs text-slate-500">
                {t("charts.service")}
              </span>
            </div>
          </div>
        </div>

        {/* Chart 2: Hourly Trend */}
        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {t("charts.uptimeHour")}
            </h4>
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Icon name="show_chart" className="text-lg" />
            </div>
          </div>

          <div className="h-64 w-full min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayHourly}>
                <defs>
                  <linearGradient id="colorUptime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontWeight: 900, fill: "#94A3B8" }}
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "var(--glass-shadow)",
                    background: "var(--glass-bg)",
                    backdropFilter: "blur(12px)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="uptime"
                  stroke="#06b6d4"
                  fillOpacity={1}
                  fill="url(#colorUptime)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-[10px] text-slate-400 italic">
              {displayHourly.length > 0
                ? t("charts.realtime")
                : t("charts.awaiting")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
