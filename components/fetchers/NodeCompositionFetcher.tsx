import { getNodeComposition } from "@/services/stats";
import { NodeComposition } from "../NodeComposition";

export async function NodeCompositionFetcher({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : undefined;
  const provider =
    typeof params.provider === "string" ? params.provider : undefined;

  const data = await getNodeComposition(state, provider);
  return <NodeComposition data={data} />;
}

export function NodeCompositionSkeleton() {
  return <div className="glass-card h-96 w-full animate-pulse bg-slate-100/50 dark:bg-slate-800/50" />;
}
