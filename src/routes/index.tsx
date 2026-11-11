import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAppStatus } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, 
      { title: "PG Manager" },
      { name: "description", content: "Run your PG: beds, residents, rent and payments in one place." },
      { property: "og:title", content: "PG Manager" },
      { property: "og:description", content: "Run your PG: beds, residents, rent and payments in one place." },
    ],
  }),
  beforeLoad: async () => {
    const s = await getAppStatus();
    if (!s.db || !s.schema || !s.hasOwner) throw redirect({ to: "/setup" });
    if (!s.user) throw redirect({ to: "/login" });
    throw redirect({ to: "/dashboard" });
  },
});
