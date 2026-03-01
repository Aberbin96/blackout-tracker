"use client";

import { useEffect, useState } from "react";
import { Icon } from "./atoms/Icon";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface SidebarProps {
  states: string[];
  providers: string[];
}

export function Sidebar({ states, providers }: SidebarProps) {
  const t = useTranslations("Dashboard");
  const [isOpen, setIsOpen] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    document.addEventListener("toggleSidebar", handleToggle);
    return () => document.removeEventListener("toggleSidebar", handleToggle);
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replace(`${pathname}?${params.toString()}`);
  };

  const activeState = searchParams.get("state") || "";
  const activeProvider = searchParams.get("provider") || "";

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 h-[100dvh] 
          border-r border-white/10 glass-card rounded-none p-5 flex flex-col gap-8
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:block lg:sticky lg:h-[calc(100vh-80px)]
          overflow-y-auto
        `}
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-sm font-black uppercase tracking-[0.2em] italic">
            {t("sidebar.neural")}
          </h1>
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-accent animate-pulse"></div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              {t("sidebar.version")}
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="space-y-6 pt-6 border-t border-white/5">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            {t("sidebar.config")}
          </h2>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-secondary dark:text-accent uppercase italic">
              {t("sidebar.region")}
            </label>
            <div className="relative">
              <select
                value={activeState}
                onChange={(e) => handleFilterChange("state", e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer pr-10"
              >
                <option value="">{t("sidebar.allRegions")}</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-secondary dark:text-accent uppercase italic">
              {t("sidebar.backbone")}
            </label>
            <div className="relative">
              <select
                value={activeProvider}
                onChange={(e) => handleFilterChange("provider", e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer pr-10"
              >
                <option value="">{t("sidebar.allCarriers")}</option>
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {(activeState || activeProvider) && (
            <button
              onClick={() => replace(pathname)}
              className="w-full py-2.5 text-[10px] font-black text-danger uppercase hover:bg-danger/10 rounded-xl transition-all border border-dashed border-danger/40 bg-danger/5"
            >
              {t("sidebar.reset")}
            </button>
          )}
        </div>

        <nav className="flex flex-col gap-2 mt-2">
          <a
            className="flex items-center gap-4 px-4 py-3 rounded-xl bg-secondary text-white shadow-lg shadow-secondary/20 transition-transform active:scale-95"
            href="#"
          >
            <Icon name="grid_view" className="text-lg" />
            <span className="text-sm font-black uppercase tracking-wider italic">
              {t("sidebar.menu.realtime")}
            </span>
          </a>
          <a
            className="flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 hover:bg-white/5 hover:text-foreground transition-all group"
            href="#"
          >
            <Icon
              name="explore"
              className="text-lg group-hover:text-accent transition-colors"
            />
            <span className="text-sm font-black uppercase tracking-wider italic">
              {t("sidebar.menu.map")}
            </span>
          </a>
          <a
            className="flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 hover:bg-white/5 hover:text-foreground transition-all group"
            href="#"
          >
            <Icon
              name="analytics"
              className="text-lg group-hover:text-accent transition-colors"
            />
            <span className="text-sm font-black uppercase tracking-wider italic">
              {t("sidebar.menu.metrics")}
            </span>
          </a>

          <a
            className="flex items-center gap-4 px-4 py-3 rounded-xl text-accent glass-card border-accent/20 bg-accent/5 hover:bg-accent/10 transition-all mt-4 group"
            href="https://t.me/your_bot_user"
            target="_blank"
          >
            <Icon
              name="electric_bolt"
              className="text-accent group-hover:scale-110 transition-transform"
            />
            <span className="text-xs font-black italic uppercase tracking-tighter">
              {t("sidebar.menu.telegram")}
            </span>
          </a>
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5">
          <h3 className="text-[10px] font-black text-danger flex items-center gap-2 mb-4 uppercase tracking-[.2em]">
            <div className="size-2 rounded-full bg-danger animate-ping"></div>
            {t("sidebar.critical")}
          </h3>
          <div className="space-y-4">
            <div className="glass-card p-4 border-l-4 border-l-danger bg-danger/5 rounded-l-none">
              <p className="text-[10px] font-black text-danger uppercase italic">
                Maracaibo (Norte)
              </p>
              <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">
                {t("sidebar.blackout")}: 4h 12m
              </p>
            </div>
            <div className="glass-card p-4 border-l-4 border-l-danger bg-danger/5 rounded-l-none">
              <p className="text-[10px] font-black text-danger uppercase italic">
                San Cristóbal
              </p>
              <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">
                {t("sidebar.rationing")}: 6h 45m
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
