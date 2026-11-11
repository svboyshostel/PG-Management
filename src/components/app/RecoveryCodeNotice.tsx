import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/** Shows a freshly issued recovery code once. The code is never shown again after leaving. */
export function RecoveryCodeNotice({
  code,
  onDone,
  doneLabel = "Continue",
}: {
  code: string;
  onDone: () => void;
  doneLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-primary" /> Your recovery code
        </div>
        <p className="mt-3 select-all break-all rounded-md bg-background p-3 text-center font-mono text-lg tracking-wider">
          {code}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              toast.success("Copied");
            } catch {
              toast.error("Couldn't copy — please write it down.");
            }
          }}
        >
          <Copy className="mr-2 h-4 w-4" /> Copy code
        </Button>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>If you forget your password, this code lets you set a new one.</li>
        <li>Save it somewhere safe, like a password manager or on paper. It will not be shown again.</li>
        <li>Each code works once. After using it you get a new one.</li>
      </ul>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
        I have saved my recovery code
      </label>
      <Button className="w-full" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  );
}
