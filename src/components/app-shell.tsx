import { useEffect, useMemo } from "react";

import { getRandomAppBackground } from "@/assets/backgrounds";
import { CollectionManager } from "@/components/collection-manager";
import { QueryWorkspace } from "@/components/query-workspace";
import { useAppStore } from "@/store/use-app-store";

import hormusLogoUrl from "../../hormus.png";

export function AppShell() {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const isBootstrapping = useAppStore((state) => state.isBootstrapping);
  const splashBackground = useMemo(() => getRandomAppBackground(), []);

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
      <div
        className="flex min-h-screen items-center justify-center px-6 text-foreground"
        style={{
          backgroundImage: `linear-gradient(rgba(8, 9, 11, 0.72), rgba(8, 9, 11, 0.84)), url(${splashBackground.imageUrl})`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="rounded-lg border border-white/10 bg-[#0c0e11]/80 px-10 py-9 text-center shadow-[0_30px_80px_rgba(0,0,0,0.38)] backdrop-blur-sm">
          <div className="mx-auto size-12">
            <img src={hormusLogoUrl} alt="Hormus" className="size-full object-contain" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Hormus</h1>
          <p className="mt-2 text-sm text-muted-foreground">Loading saved connections...</p>
        </div>
      </div>
    );
  }

  if (currentScreen === "workspace") {
    return <QueryWorkspace />;
  }

  return <CollectionManager />;
}
