import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getAppStatus, login } from "@/lib/auth.functions";
import { getDemoStatus } from "@/lib/demo.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PwaInstallControl } from "@/components/app/pwa-install";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Sign in — PG Manager" },
      { name: "description", content: "Sign in to manage your PG." },
      { property: "og:title", content: "Sign in — PG Manager" },
      { property: "og:description", content: "Sign in to manage your PG." },
    ],
  }),
  beforeLoad: async () => {
    const s = await getAppStatus();
    if (!s.db || !s.schema || !s.hasOwner) throw redirect({ to: "/setup" });
    if (s.user) throw redirect({ to: "/dashboard" });
  },
  loader: () => getDemoStatus(),
  component: Login,
});

function Login() {
  const { enabled: demoEnabled } = Route.useLoaderData();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
          PG Manager
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold">Sign in</h1>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await login({ data: { email, password } });
              nav({ to: "/dashboard" });
            } catch (err: any) {
              toast.error(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="e">Email</Label>
            <Input
              id="e"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p">Password</Label>
            <div className="relative">
              <Input
                id="p"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-11"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 text-muted-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          <Button className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link
              to="/forgot-password"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
            <span className="mx-1.5">·</span>
            The owner can also reset staff passwords.
          </p>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <PwaInstallControl variant="outline" />
          {demoEnabled && (
            <Button asChild size="sm" variant="outline">
              <Link to="/demo">Demo Preview</Link>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
