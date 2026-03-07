"use client";

import { useTranslations } from "next-intl";
import { Icon } from "./atoms/Icon";

interface Props {
  data: any[];
}

export function NodeComposition({ data }: Props) {
  const t = useTranslations("Dashboard");

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-black text-foreground uppercase tracking-wider text-sm">
              {t("sidebar.neural")}
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              {t("stats.infrastructureDesc")}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-primary/5 text-primary">
            <Icon name="hub" className="text-xl opacity-40" />
          </div>
        </div>

        <div className="space-y-8 flex-1">
          {data.map((p, idx) => (
            <div key={idx} className="space-y-3 group">
              <div className="flex justify-between text-[11px] font-black uppercase tracking-tighter">
                <span className="group-hover:text-secondary transition-colors underline decoration-secondary/30 underline-offset-4 decoration-2">
                  {p.name}
                </span>
                <span className={`${p.textColor} flex items-center gap-1`}>
                  <div
                    className={`size-1.5 rounded-full ${p.status === "status.operational" ? "bg-success" : p.status.includes("degraded") || p.status.includes("slow") ? "bg-warning" : "bg-danger"} animate-pulse`}
                  ></div>
                  {t(p.status as any)}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-2.5 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`${p.color} h-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                  style={{ width: `${p.percent}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 font-black uppercase tracking-widest">
                <span>
                  {p.total} {t("stats.devices")}
                </span>
                <span>
                  {p.online} {t("status.live")} ({p.percent}%)
                </span>
              </div>
            </div>
          ))}
          {data.length === 0 && (
            <p className="text-sm text-slate-400 font-bold italic text-center py-6">
              {t("charts.awaiting")}
            </p>
          )}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 -mx-6 -mb-6 p-6 rounded-b-2xl">
          <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-[0.2em]">
            {t("sidebar.config")}
          </h4>
          <div className="flex flex-wrap gap-5 items-center">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {t("status.operational")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {t("status.outage")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-slate-400"></div>
              <span className="text-[10px] font-black uppercase tracking-tighter opacity-60">
                {t("status.unknown")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
