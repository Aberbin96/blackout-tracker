import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ params }: PageProps) {
  return (
    <div className="bg-background-light dark:bg-background-dark h-[100dvh] flex flex-col font-display">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mb-8"></div>
        </main>
      </div>
    </div>
  );
}
