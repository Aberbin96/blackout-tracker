import { getMapData } from "@/services/stats";
import { MapWrapper } from "../MapWrapper";

export async function MapFetcher({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : undefined;
  const provider =
    typeof params.provider === "string" ? params.provider : undefined;

  const data = await getMapData(state, provider);
  return <MapWrapper data={data} />;
}
