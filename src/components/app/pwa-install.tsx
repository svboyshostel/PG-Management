import { useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getManualInstallInstruction, getPwaServerSnapshot, getPwaSnapshot, promptPwaInstall, subscribePwa } from "@/lib/pwa";

export function PwaInstallControl({ variant = "outline", fullWidth = false }: { variant?: "outline" | "ghost" | "secondary"; fullWidth?: boolean }) {
  const { installed, canPrompt } = useSyncExternalStore(subscribePwa, getPwaSnapshot, getPwaServerSnapshot);
  const [showInstructions, setShowInstructions] = useState(false);

  if (installed) return null;

  async function handleInstall() {
    if (canPrompt) {
      const outcome = await promptPwaInstall();
      if (outcome !== "unavailable") {
        setShowInstructions(false);
        return;
      }
    }
    setShowInstructions((open) => !open);
  }

  const hint = typeof navigator !== "undefined" ? getManualInstallInstruction(navigator.userAgent) : getManualInstallInstruction();

  return (
    <div className={fullWidth ? "w-full space-y-2" : "space-y-2"}>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={fullWidth ? "w-full justify-start" : undefined}
        onClick={() => void handleInstall()}
      >
        <Download className="h-4 w-4" />
        Install PG Manager
      </Button>
      {showInstructions && (
        <div
          role="region"
          aria-label="Browser installation steps"
          className="rounded-lg border bg-card p-3 text-left text-xs text-muted-foreground shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-foreground">Install via browser menu</p>
            <button
              type="button"
              aria-label="Close install instructions"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setShowInstructions(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1">{hint}</p>
        </div>
      )}
    </div>
  );
}

