import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/float/$id/track")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getFloatTrack, json } = await import("@/server/floatchat/data.server");
        try {
          return json(await getFloatTrack(params.id));
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
