import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/profile/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getProfileDetails, json } = await import("@/server/floatchat/data.server");
        try {
          const data = await getProfileDetails(params.id);
          return data ? json(data) : json({ error: "Profile not found" }, 404);
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
