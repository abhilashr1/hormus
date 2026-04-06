/// <reference types="vite/client" />

import type { HormusDesktopApi } from "@/shared/ipc";

declare global {
  interface Window {
    hormus?: HormusDesktopApi;
  }
}

export {};
