import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async () => {
        const { getStats, json } = await import("@/server/floatchat/data.server");
        try {
          return json(await getStats());
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
