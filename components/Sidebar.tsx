"use client";

import { useEffect, useState } from "react";
import { Icon } from "./atoms/Icon";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface SidebarProps {
  states: string[];
  providers: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeBlackouts?: any[];
}

export function Sidebar({
  states,
  providers,
  activeBlackouts = [],
}: SidebarProps) {
  const t = useTranslations("Dashboard");
  const [isOpen, setIsOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  useEffect(() => {
    const initialTimer = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 60000);
    const handleToggle = () => setIsOpen((prev) => !prev);
    document.addEventListener("toggleSidebar", handleToggle);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener("toggleSidebar", handleToggle);
    };
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

  // Helper to format duration
  const getDuration = (startedAt: string) => {
    if (!now) return "0m";
    const diff = now - new Date(startedAt).getTime();
    if (diff < 0) return "0m";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

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
          border-r border-slate-200 dark:border-white/10 glass-card rounded-none p-5 flex flex-col gap-8
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:block lg:sticky lg:h-[calc(100vh-80px)]
          overflow-y-auto
        `}
      >
        {/* Filters Section */}
        <div className="space-y-6 pt-6">
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
                className="w-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-white/10 text-primary dark:text-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer pr-10"
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
                className="w-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-white/10 text-primary dark:text-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer pr-10"
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
        </div>

        {activeBlackouts.length > 0 && (
          <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5">
            <h3 className="text-[10px] font-black text-danger flex items-center gap-2 mb-4 uppercase tracking-[.2em]">
              <div className="size-2 rounded-full bg-danger animate-ping"></div>
              {t("sidebar.critical") || "ZONA CRÍTICA"}
            </h3>
            <div className="space-y-4">
              {activeBlackouts.slice(0, 3).map((event) => {
                const severity =
                  event.metadata?.current_severity ||
                  event.metadata?.initial_severity ||
                  "unknown";
                const isMassive = severity === "massive";
                const duration = getDuration(event.started_at);

                return (
                  <div
                    key={event.id}
                    className={`glass-card p-4 border-l-4 ${isMassive ? "border-l-danger bg-danger/5" : "border-l-warning bg-warning/5"} rounded-l-none`}
                  >
                    <p
                      className={`text-[10px] font-black ${isMassive ? "text-danger" : "text-warning"} uppercase italic`}
                    >
                      {event.state}
                    </p>
                    <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">
                      {isMassive
                        ? t("sidebar.blackout") || "APAGÓN MASIVO"
                        : t("sidebar.rationing") || "FALLA PARCIAL"}
                      : {duration}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
