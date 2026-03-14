import { getFiltersData, getActiveBlackouts } from "@/services/stats";
import { Sidebar } from "../Sidebar";

export async function SidebarFetcher() {
  const [filters, blackouts] = await Promise.all([
    getFiltersData(),
    getActiveBlackouts(),
  ]);

  return (
    <Sidebar
      states={filters.states}
      providers={filters.providers}
      activeBlackouts={blackouts}
    />
  );
}

export function SidebarSkeleton() {
  return <div className="hidden lg:block w-64 h-screen animate-pulse bg-slate-100/50 dark:bg-slate-800/50" />;
}
