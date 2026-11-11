import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getAppStatus, resetWithRecoveryCode } from "@/lib/auth.functions";
import { RecoveryCodeNotice } from "@/components/app/RecoveryCodeNotice";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Forgot password — PG Manager" },
      { name: "description", content: "Set a new owner password with your PG Manager recovery code." },
      { property: "og:title", content: "Forgot password — PG Manager" },
      { property: "og:description", content: "Set a new owner password with your PG Manager recovery code." },
    ],
  }),
  beforeLoad: async () => {
    const s = await getAppStatus();
    if (!s.db || !s.schema || !s.hasOwner) throw redirect({ to: "/setup" });
    if (s.user) throw redirect({ to: "/dashboard" });
  },
  component: ForgotPassword,
});

function ForgotPassword() {
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", code: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
          PG Manager
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold">
          {newCode ? "Password changed" : "Forgot password"}
        </h1>

        {newCode ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Your old recovery code no longer works. Here is your new one.
            </p>
            <RecoveryCodeNotice
              code={newCode}
              doneLabel="Go to sign in"
              onDone={() => {
                setNewCode(null);
                nav({ to: "/login" });
              }}
            />
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (f.password !== f.confirm) {
                toast.error("The two passwords don't match.");
                return;
              }
              setBusy(true);
              try {
                const r = await resetWithRecoveryCode({
                  data: { email: f.email, code: f.code, password: f.password },
                });
                setF({ email: "", code: "", password: "", confirm: "" });
                setNewCode(r.recoveryCode);
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-muted-foreground">
              Owner: enter your email and the recovery code you saved at setup. Staff: ask the
              owner to set a new password for you.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="e">Email</Label>
              <Input id="e" type="email" required autoComplete="email" value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c">Recovery code</Label>
              <Input id="c" required autoComplete="off" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                className="font-mono uppercase" value={f.code}
                onChange={(e) => setF({ ...f, code: e.target.value })} />
            </div>
            {(["password", "confirm"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={k}>{k === "password" ? "New password (min 8)" : "Confirm new password"}</Label>
                <div className="relative">
                  <Input id={k} type={show ? "text" : "password"} required minLength={8} autoComplete="new-password"
                    className="pr-10" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                  {k === "password" && (
                    <button type="button" aria-label={show ? "Hide password" : "Show password"}
                      onClick={() => setShow(!show)}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <Button className="w-full" disabled={busy}>
              {busy ? "Checking…" : "Set new password"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
