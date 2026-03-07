"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const toggleLanguage = () => {
    const nextLocale = locale === "en" ? "es" : "en";
    startTransition(() => {
      // In next-intl w/ Next.js App Router, switching locale usually involves just navigating
      // to the new path prefix.
      if (!pathname) return;

      const segments = pathname.split("/");
      if (segments.length > 1) {
        segments[1] = nextLocale;
      }
      const newPath = segments.join("/") || `/${nextLocale}`;
      router.replace(newPath);
    });
  };

  return (
    <button
      onClick={toggleLanguage}
      disabled={isPending}
      className="flex items-center gap-2 h-10 px-4 glass-card bg-secondary/5 text-secondary dark:text-accent hover:bg-secondary/10 transition-all duration-200 rounded-xl font-black text-[11px] uppercase tracking-wider disabled:opacity-50"
    >
      <Globe className="w-3.5 h-3.5" />
      <span>{locale.toUpperCase()}</span>
    </button>
  );
}
