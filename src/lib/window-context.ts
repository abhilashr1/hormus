export type WindowScreen = "collection-manager" | "workspace";

export function getWindowScreen(): WindowScreen {
  if (typeof window === "undefined") {
    return "collection-manager";
  }

  const screen = new URLSearchParams(window.location.search).get("screen");
  return screen === "workspace" ? "workspace" : "collection-manager";
}

export function getWindowConnectionId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return new URLSearchParams(window.location.search).get("connectionId") ?? undefined;
}
