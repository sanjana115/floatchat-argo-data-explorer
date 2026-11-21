import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Leaflet and Plotly touch `window` at import time, so the app loads only in the browser.
const FloatChatApp = lazy(() => import("@/floatchat/FloatChatApp"));

const SITE_URL = "https://floatchat-argo-data-explorer.lovable.app";

export const Route = createFileRoute("/floatchat")({
  head: () => ({
    meta: [
      { title: "Explore Argo ocean profiles | FloatChat" },
      {
        name: "description",
        content:
          "Explore real Argo float temperature and salinity profiles on a map and ask questions in plain language, with evidence for every answer.",
      },
      { property: "og:title", content: "Explore Argo ocean profiles | FloatChat" },
      {
        property: "og:description",
        content:
          "Browse real Argo ocean profiles on a map and ask questions in plain language, with evidence for every answer.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/floatchat` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/floatchat` }],
  }),
  component: FloatChatRoute,
});

function Loading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading FloatChat…
    </div>
  );
}

function FloatChatRoute() {
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <FloatChatApp />
      </Suspense>
    </ClientOnly>
  );
}