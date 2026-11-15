import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Leaflet and Plotly touch `window` at import time, so the app loads only in the browser.
const FloatChatApp = lazy(() => import("@/floatchat/FloatChatApp"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FloatChat — Ask questions about real Argo ocean data" },
      { name: "description", content: "Explore real Argo float temperature and salinity profiles on a map and ask questions in plain language, with full query provenance." },
      { property: "og:title", content: "FloatChat — Ask questions about real Argo ocean data" },
      { property: "og:description", content: "Map and chat over real Argo float profiles, with validated read-only queries and evidence for every answer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Loading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading FloatChat…
    </div>
  );
}

function Index() {
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <FloatChatApp />
      </Suspense>
    </ClientOnly>
  );
}
