import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/terms")({
  server: {
    handlers: {
      GET: async () => {
        const { getTerms, json } = await import("@/server/floatchat/data.server");
        try {
          return json(await getTerms());
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
