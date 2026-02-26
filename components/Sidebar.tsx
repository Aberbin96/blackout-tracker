"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Button } from "./atoms/Button";
import { Icon } from "./atoms/Icon";

interface SidebarProps {
  minDate?: string;
}

export function Sidebar({ minDate }: SidebarProps) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    document.addEventListener("toggleSidebar", handleToggle);
    return () => document.removeEventListener("toggleSidebar", handleToggle);
  }, []);

  useEffect(() => {}, [searchParams]);

  const updateFilters = (updates: Record<string, string | boolean>) => {
    const params = new URLSearchParams(searchParams.toString());

    const currentParams = {
      ...updates,
    };

    router.push(`?${params.toString()}`);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-72 h-[100dvh] 
        border-r border-slate-200/60 dark:border-slate-800 
        bg-white dark:bg-slate-900 shadow-2xl lg:shadow-none
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:block lg:sticky lg:h-[calc(100vh-73px)]
        overflow-y-auto flex-col
      `}
      >
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between lg:hidden mb-2">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              {t("filters")}
            </h2>
            <Button onClick={() => setIsOpen(false)} variant="icon">
              <Icon name="close" className="text-xl" />
            </Button>
          </div>

          <div className="border-b border-slate-200/60 dark:border-slate-800 pb-6">
            <h3 className="text-slate-800 dark:text-white text-sm font-bold uppercase tracking-wider mb-4">
              {t("date")}
            </h3>
            <div className="flex flex-col gap-3"></div>
          </div>
        </div>
      </aside>
    </>
  );
}
