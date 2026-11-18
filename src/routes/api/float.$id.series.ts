import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/float/$id/series")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { getFloatSeries, json } = await import("@/server/floatchat/data.server");
        const { toleranceFor } = await import("@/lib/floatchat/chartData");
        const url = new URL(request.url);
        const pressure = Number(url.searchParams.get("pressure") ?? "10");
        if (!Number.isFinite(pressure) || pressure < 0 || pressure > 6000) {
          return json({ error: "pressure must be between 0 and 6000 dbar" }, 400);
        }
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(params.id)) return json({ error: "Invalid float id" }, 400);
        try {
          return json(await getFloatSeries(params.id, pressure, toleranceFor(pressure)));
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
