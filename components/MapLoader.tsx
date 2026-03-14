"use client";

import { useTranslations } from "next-intl";

export function MapLoader() {
  const t = useTranslations("Dashboard.map");
  return (
    <div className="w-full h-[400px] bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl flex items-center justify-center">
      <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">
        {t("loading")}
      </div>
    </div>
  );
}
