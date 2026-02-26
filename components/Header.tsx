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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = "Monitor flight transparency in Venezuela 🇻🇪✈️";

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: "Radar de Vuelos Venezuela",
          text: shareText,
          url: shareUrl,
        })
        .catch(console.error);
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      alert(t("copySuccess"));
    }
  };

  const shareToX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank");
  };

  const shareToWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    window.open(url, "_blank");
  };

  const shareToTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  };

  return (
    <header className="flex flex-wrap items-center bg-white/80 backdrop-blur-md dark:bg-slate-900 px-4 sm:px-6 py-3 sticky top-0 z-50 border-b border-solid border-slate-200/60 dark:border-slate-800">
      {/* 1. Logo & Title (Top Left) */}
      <div className="flex items-center gap-2 sm:gap-3 text-primary dark:text-slate-100">
        <div className="size-8 shrink-0 bg-primary rounded-lg flex items-center justify-center text-white shadow-sm shadow-primary/20">
          <Icon name="flight_takeoff" />
        </div>
        <h2 className="text-slate-800 dark:text-white text-[15px] sm:text-lg font-bold leading-tight tracking-tight">
          {t("title")} 🇻🇪
        </h2>
        <div className="hidden lg:block"></div>
      </div>

      {/* 2. Global Actions: Theme, Lang, Share (Mobile Top Right, Desktop Far Right) */}
      <div className="flex items-center gap-1 order-2 lg:order-3 ml-auto lg:ml-0">
        <Button onClick={toggleTheme} variant="icon" title={t("theme")}>
          <Icon
            name={
              mounted && resolvedTheme === "dark" ? "light_mode" : "dark_mode"
            }
            className="text-xl"
          />
        </Button>
        <Button onClick={toggleLanguage} variant="icon" title={t("language")}>
          <Icon name="language" className="text-xl" />
          <span className="text-xs font-bold uppercase ml-1 sm:ml-2">
            {locale}
          </span>
        </Button>
        {/* Social Specific Shares (Hidden on small mobile) */}
        <div className="hidden sm:flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 ml-1 pl-1">
          {/* X (Twitter) */}
          <button
            onClick={shareToX}
            title="Share on X"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-[18px] h-[18px]"
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.908-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </button>
          {/* WhatsApp */}
          <button
            onClick={shareToWhatsApp}
            title="Share on WhatsApp"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-[18px] h-[18px]"
              fill="currentColor"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </button>
          {/* Telegram */}
          <button
            onClick={shareToTelegram}
            title="Share on Telegram"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-[18px] h-[18px]"
              fill="currentColor"
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </button>
        </div>

        <Button onClick={handleShare} variant="icon" title={t("share")}>
          <Icon name="share" className="text-xl" />
        </Button>
      </div>

      {/* 3. Filter & About (Mobile Bottom Row, Desktop Middle Right) */}
      <div className="flex items-center gap-2 w-full lg:w-auto order-3 lg:order-2 mt-3 lg:mt-0 pt-3 lg:pt-0 border-t border-slate-200/60 dark:border-slate-800 lg:border-none lg:ml-auto lg:mr-4">
        {/* Mobile Filter Toggle */}
        <Button
          className="lg:hidden flex-1 flex justify-center items-center gap-2 px-3 h-10"
          onClick={() =>
            document.dispatchEvent(new CustomEvent("toggleSidebar"))
          }
          variant="secondary"
          title={t("filters")}
        >
          <Icon name="filter_list" className="text-xl" />
          <span className="text-sm font-bold tracking-wide">
            {t("filters")}
          </span>
        </Button>

        <a
          href={`/${locale}/about`}
          className="flex-1 lg:flex-none flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 transition-allh-10 lg:h-9 px-4"
        >
          <Icon name="info" className="text-xl" />
          <span className="text-sm font-bold tracking-wide">{t("info")}</span>
        </a>
      </div>
    </header>
  );
}
