export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaState {
  installed: boolean;
  canPrompt: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let initialized = false;
let cachedSnapshot: PwaState = { installed: false, canPrompt: false };
const SERVER_SNAPSHOT: PwaState = { installed: false, canPrompt: false };
const listeners = new Set<() => void>();

function syncSnapshot() {
  const nextInstalled = installed;
  const nextCanPrompt = Boolean(deferredPrompt);
  if (cachedSnapshot.installed !== nextInstalled || cachedSnapshot.canPrompt !== nextCanPrompt) {
    cachedSnapshot = { installed: nextInstalled, canPrompt: nextCanPrompt };
  }
  for (const listener of listeners) listener();
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standaloneMedia = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return standaloneMedia || nav.standalone === true;
}

/** Browser-specific fallback steps when the native install prompt is unavailable. */
export function getManualInstallInstruction(userAgent = ""): string {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return "Tap Share in Safari, then choose Add to Home Screen.";
  }
  if (/android/.test(ua)) {
    return "Open your browser menu (⋮) and choose Install app or Add to Home screen.";
  }
  if (/macintosh/.test(ua) && /safari/.test(ua) && !/chrome|chromium|edg/.test(ua)) {
    return "In Safari, choose File → Add to Dock to install PG Manager.";
  }
  return "Open your browser menu or click the install icon in the address bar, then select Install PG Manager.";
}

export function initPwa(): () => void {
  if (typeof window === "undefined" || initialized) return () => {};
  initialized = true;
  installed = isStandaloneDisplay();
  syncSnapshot();

  const onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    syncSnapshot();
  };

  const onAppInstalled = () => {
    deferredPrompt = null;
    installed = true;
    syncSnapshot();
  };

  const media = typeof window.matchMedia === "function" ? window.matchMedia("(display-mode: standalone)") : null;
  const onDisplayChange = () => {
    installed = isStandaloneDisplay();
    if (installed) deferredPrompt = null;
    syncSnapshot();
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
  media?.addEventListener?.("change", onDisplayChange);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        void reg.update().catch(() => undefined);
      })
      .catch(() => undefined);
  }

  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
    media?.removeEventListener?.("change", onDisplayChange);
    initialized = false;
  };
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  syncSnapshot();
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  if (choice.outcome === "accepted") {
    installed = true;
    syncSnapshot();
  }
  return choice.outcome;
}

export function subscribePwa(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPwaSnapshot(): PwaState {
  return cachedSnapshot;
}

export function getPwaServerSnapshot(): PwaState {
  return SERVER_SNAPSHOT;
}

