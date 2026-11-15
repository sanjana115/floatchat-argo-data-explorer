import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/import-profile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleImport } = await import("@/server/floatchat/import.server");
        const res = await handleImport(request);
        if (res.ok) (await import("@/server/floatchat/data.server")).invalidateStatsCache();
        return res;
      },
    },
  },
});
