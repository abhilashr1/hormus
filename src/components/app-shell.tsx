import { useEffect } from "react";
import { Card } from "@/components/ui/card";
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
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(84,130,255,0.18),_transparent_30%),linear-gradient(180deg,_#07111f_0%,_#050914_100%)] px-6 text-[var(--foreground)]">
        <Card className="w-full max-w-md p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Hormus</p>
          <h1 className="mt-3 text-xl font-semibold">Loading workspace</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Preparing saved connections, editor tabs, and desktop state.
          </p>
        </Card>
      </div>
    );
  }

  if (currentScreen === "workspace") {
    return <QueryWorkspace />;
  }

  return <CollectionManager />;
}
