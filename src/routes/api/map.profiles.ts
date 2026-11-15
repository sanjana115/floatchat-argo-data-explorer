import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/map/profiles")({
  server: {
    handlers: {
      GET: async () => {
        const { getMapProfiles, json } = await import("@/server/floatchat/data.server");
        try {
          return json(await getMapProfiles());
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
