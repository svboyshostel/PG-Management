import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getAppStatus, runSetup } from "@/lib/auth.functions";
import { getDemoStatus } from "@/lib/demo.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RecoveryCodeNotice } from "@/components/app/RecoveryCodeNotice";
import { PwaInstallControl } from "@/components/app/pwa-install";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, 
      { title: "Set up your PG — PG Manager" },
      { name: "description", content: "Connect your database and create the owner account." },
      { property: "og:title", content: "Set up PG Manager" },
      { property: "og:description", content: "Connect your database and create the owner account." },
    ],
  }),
  beforeLoad: async () => {
    const s = await getAppStatus();
    if (s.db && s.schema && s.hasOwner) throw redirect({ to: s.user ? "/dashboard" : "/login" });
    return { status: s };
  },
  loader: () => getDemoStatus(),
  component: Setup,
});

function Setup() {
  const { status } = Route.useRouteContext();
  const { enabled: demoEnabled } = Route.useLoaderData();
  const nav = useNavigate();
  const [f, setF] = useState({ pgName: "", fullName: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg p-8">
        <div className="font-display text-sm font-semibold uppercase tracking-widest text-primary">PG Manager</div>
        <h1 className="mt-2 font-display text-3xl font-semibold">First-time setup</h1>
        {code ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium">One last step: save your recovery code.</p>
            <RecoveryCodeNotice code={code} doneLabel="Go to dashboard" onDone={() => { setCode(null); nav({ to: "/dashboard" }); }} />
          </div>
        ) : !status.db ? (
          <div className="mt-6 space-y-3 text-sm">
            <p className="font-medium">Step 1: connect your Neon database.</p>
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Open your Neon project → <b>Connect</b> → copy the connection string (starts with <code>postgresql://</code>).</li>
              <li>Add it as an environment variable named <b>DATABASE_URL</b> (locally in your <code>.env</code> file, or in Vercel under Project → Settings → Environment Variables).</li>
              <li>Reload this page.</li>
            </ol>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await runSetup({ data: f });
                toast.success("All set! Welcome.");
                setCode(r.recoveryCode);
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {"error" in status && status.error && <p className="text-sm text-destructive">{status.error}</p>}
            <p className="text-sm text-muted-foreground">Database connected. Create your PG and the owner login. Tables are created automatically.</p>
            {(["pgName", "fullName", "email", "password"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={k}>{{ pgName: "PG name", fullName: "Your name", email: "Email", password: "Password (min 8)" }[k]}</Label>
                <Input id={k} type={k === "password" ? "password" : k === "email" ? "email" : "text"} required value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Setting up…" : "Create my PG"}</Button>
          </form>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <PwaInstallControl variant="outline" />
          {demoEnabled && (
            <Button asChild size="sm" variant="outline">
              <Link to="/demo">Open Demo Preview (read-only)</Link>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
