import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleAsk } = await import("@/server/floatchat/ask.server");
        return handleAsk(request);
      },
    },
  },
});
