"use client";

import { useTranslations } from "next-intl";
import { Icon } from "./atoms/Icon";

interface Props {
  availability: number;
  activeSensors: number;
  onlineSensors: number;
  avgLatency: number;
  trend: string;
}

export function DashboardStats({
  availability,
  activeSensors,
  onlineSensors,
  avgLatency,
  trend,
}: Props) {
  const t = useTranslations("Dashboard");

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass-card p-6 flex flex-col gap-3 group hover:scale-[1.02] transition-transform duration-300">
        <div className="flex justify-between items-start">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            {t("stats.availability")}
          </p>
          <div className="p-2 rounded-lg bg-warning/10 text-warning">
            <Icon name="signal_cellular_alt" className="text-lg" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-auto">
          <p className="text-4xl font-black tracking-tight text-foreground">
            {availability}%
          </p>
          <span className="text-danger text-xs font-black flex items-center bg-danger/10 px-2 py-0.5 rounded-full">
            <Icon name="trending_down" className="text-sm mr-1" /> {trend}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-warning rounded-full transition-all duration-1000"
            style={{ width: `${availability}%` }}
          />
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col gap-3 group hover:scale-[1.02] transition-transform duration-300">
        <div className="flex justify-between items-start">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            {t("stats.infrastructure")}
          </p>
          <div className="p-2 rounded-lg bg-accent/10 text-accent">
            <Icon name="router" className="text-lg" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-auto">
          <p className="text-4xl font-black tracking-tight text-foreground">
            {activeSensors.toLocaleString()}
          </p>
          <span className="text-success text-xs font-black flex items-center bg-success/10 px-2 py-0.5 rounded-full">
            <Icon name="check_circle" className="text-sm mr-1" />{" "}
            {onlineSensors} {t("stats.liveNodes")}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-medium">
          {t("stats.targets")}
        </p>
      </div>

      <div className="glass-card p-6 flex flex-col gap-3 group hover:scale-[1.02] transition-transform duration-300">
        <div className="flex justify-between items-start">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            {t("stats.latency")}
          </p>
          <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
            <Icon name="speed" className="text-lg" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-auto">
          <p className="text-4xl font-black tracking-tight text-foreground">
            {avgLatency}
            <span className="text-lg font-bold ml-1 text-slate-400">ms</span>
          </p>
          <span
            className={`${avgLatency < 150 ? "text-success bg-success/10" : "text-warning bg-warning/10"} text-xs font-black flex items-center px-2 py-0.5 rounded-full`}
          >
            <Icon
              name={avgLatency < 150 ? "bolt" : "timer"}
              className="text-sm mr-1"
            />
            {avgLatency < 150 ? t("stats.fast") : t("stats.slow")}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-medium">
          {t("stats.response")}
        </p>
      </div>
    </section>
  );
}
