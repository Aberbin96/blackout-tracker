"use client";

import { useTranslations } from "next-intl";

interface Props {
  data: any[];
}

export function RegionalTable({ data }: Props) {
  const t = useTranslations("Dashboard");

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 border-b border-primary/5 flex justify-between items-center">
        <h3 className="font-black text-foreground uppercase tracking-wider text-sm">
          {t("table.title")}
        </h3>
        <span className="text-[10px] bg-secondary/10 px-2 py-1 rounded-full text-secondary font-black tracking-widest animate-pulse">
          {t("status.live")}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
            <tr>
              <th className="px-6 py-4 font-black">{t("table.region")}</th>
              <th className="px-6 py-4 font-black">
                {t("table.availability")}
              </th>
              <th className="px-6 py-4 font-black">{t("table.status")}</th>
              <th className="px-6 py-4 font-black text-right">
                {t("table.sync")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {data.map((region, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
              >
                <td className="px-6 py-4 transition-colors">
                  <div className="flex items-center gap-2">
                    {region.isAlert && (
                      <div className="size-1.5 rounded-full bg-danger animate-pulse shrink-0" />
                    )}
                    <span
                      className={`
                      text-sm transition-colors
                      ${
                        region.isState
                          ? "font-black uppercase tracking-tight text-slate-900 dark:text-white"
                          : "font-medium text-slate-500 dark:text-slate-400 italic pl-4"
                      }
                    `}
                    >
                      {region.location}
                    </span>
                  </div>
                </td>
                <td
                  className={`px-6 py-4 font-black text-base ${region.color}`}
                >
                  {region.availability}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full ${region.bg} ${region.color} text-[10px] font-black uppercase tracking-tighter whitespace-nowrap`}
                  >
                    {region.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase text-right">
                  {region.lastSync}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-slate-400 italic"
                >
                  {t("table.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
