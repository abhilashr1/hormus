import { useEffect } from "react";
import { CollectionManager } from "@/components/collection-manager";
import { QueryWorkspace } from "@/components/query-workspace";
import { useAppStore } from "@/store/use-app-store";
import hormusLogoUrl from "../../hormus.png";

export function AppShell() {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const isBootstrapping = useAppStore((state) => state.isBootstrapping);

  useEffect(() => {
    if (window.hormus && navigator.platform.toLowerCase().includes("mac")) {
      document.documentElement.dataset.platform = "darwin";
    }

    const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? document.createElement("link");
    icon.rel = "icon";
    icon.href = hormusLogoUrl;
    document.head.append(icon);

    void useAppStore.getState().bootstrap();
  }, []);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090b] px-6 text-[var(--foreground)]">
        <div className="text-center">
          <div className="mx-auto size-12">
            <img src={hormusLogoUrl} alt="Hormus" className="size-full object-contain" />
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
