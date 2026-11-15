import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/import-profile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleImport } = await import("@/server/floatchat/import.server");
        return handleImport(request);
      },
    },
  },
});
