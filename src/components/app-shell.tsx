import { useEffect } from "react";
import { CollectionManager } from "@/components/collection-manager";
import { QueryWorkspace } from "@/components/query-workspace";
import { useAppStore } from "@/store/use-app-store";

export function AppShell() {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const isBootstrapping = useAppStore((state) => state.isBootstrapping);

  useEffect(() => {
    void useAppStore.getState().bootstrap();
  }, []);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090b] px-6 text-[var(--foreground)]">
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center border border-[var(--border)] bg-[#1b6f4f] text-lg font-semibold text-white">
            H
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Hormus</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Loading saved connections...</p>
        </div>
      </div>
    );
  }

  if (currentScreen === "workspace") {
    return <QueryWorkspace />;
  }

  return <CollectionManager />;
}
