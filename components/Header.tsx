"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "./atoms/Button";
import { Icon } from "./atoms/Icon";
import { Tooltip } from "./atoms/Tooltip";

export function Header() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const toggleLanguage = () => {
    const nextLocale = locale === "en" ? "es" : "en";
    startTransition(() => {
      if (!pathname) return;
      const segments = pathname.split("/");
      if (segments.length > 1) {
        segments[1] = nextLocale;
      }
      const newPath = segments.join("/") || `/${nextLocale}`;
      router.replace(newPath);
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: "Vzla Blackout Tracker",
          url: window.location.href,
        })
        .catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert(t("copySuccess"));
    }
  };

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-white/10 dark:border-white/5 bg-background/60 backdrop-blur-xl px-6 md:px-10 py-4 sticky top-0 z-50">
      {/* 1. Logo & Title */}
      <div className="flex items-center gap-4 text-primary dark:text-slate-100 group cursor-pointer">
        <div className="size-10 flex items-center justify-center bg-secondary rounded-xl text-white shadow-lg shadow-secondary/20 group-hover:rotate-12 transition-transform duration-300">
          <Icon name="bolt" className="text-xl" />
        </div>
        <div>
          <h2 className="text-lg font-black leading-tight tracking-tight uppercase italic flex items-center gap-2">
            Vzla{" "}
            <span className="text-secondary dark:text-accent">Blackout</span>{" "}
            Tracker
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Experimental Monitoring System
          </p>
        </div>
      </div>

      {/* 2. Actions */}
      <div className="flex flex-1 justify-end gap-3 items-center">
        <div className="hidden md:flex gap-3">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center rounded-xl h-10 w-10 glass-card bg-secondary/5 text-secondary dark:text-accent hover:bg-secondary/10 transition-all duration-200"
          >
            <Icon
              name={
                mounted && resolvedTheme === "dark" ? "light_mode" : "dark_mode"
              }
            />
          </button>

          <button
            onClick={toggleLanguage}
            className="flex items-center justify-center rounded-xl h-10 w-10 glass-card bg-secondary/5 text-secondary dark:text-accent hover:bg-secondary/10 transition-all duration-200"
          >
            <Icon name="translate" />
          </button>

          <button
            onClick={handleShare}
            className="flex items-center justify-center rounded-xl h-10 w-10 glass-card bg-secondary/5 text-secondary dark:text-accent hover:bg-secondary/10 transition-all duration-200"
          >
            <Icon name="share" />
          </button>
        </div>
      </div>
    </header>
  );
}
