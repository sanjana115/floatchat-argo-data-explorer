import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const SITE_URL = "https://floatchat-argo-data-explorer.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oceanography and Argo floats | FloatChat" },
      {
        name: "description",
        content:
          "Discover how Argo floats observe the ocean, then explore real temperature and salinity profiles with FloatChat.",
      },
      { property: "og:title", content: "Oceanography and Argo floats | FloatChat" },
      {
        property: "og:description",
        content:
          "A short introduction to ocean observations from Argo floats, with a link to explore real profiles in FloatChat.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            to="/"
            aria-label="FloatChat home"
            className="text-lg font-semibold text-foreground"
          >
            FloatChat
          </Link>
          <span className="text-sm text-muted-foreground">Ocean observations</span>
        </div>
      </header>

      <main>
        <section className="relative isolate flex min-h-[76svh] items-center overflow-hidden bg-primary text-primary-foreground">
          <img
            src="/argo-ocean-home.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-[68%_center] md:object-center"
          />
          <div className="absolute inset-0 bg-primary/65" aria-hidden="true" />

          <div className="relative mx-auto w-full max-w-6xl px-6 py-20 md:px-10">
            <div className="mb-8 flex items-center gap-4">
              <img
                src="/favicon.png"
                alt="FloatChat icon"
                className="size-16 rounded-md"
              />
              <p className="text-sm font-medium">OCEANOGRAPHY · ARGO</p>
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Reading the ocean, one float profile at a time.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-primary-foreground/90 sm:text-lg">
              Argo floats move through the sea, measuring temperature and salinity at different
              depths. FloatChat brings those real observations to a map and lets you explore them
              with plain-language questions.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" variant="secondary">
                <Link to="/floatchat">
                  Explore FloatChat
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 md:grid-cols-3 md:px-10">
            <div>
              <h2 className="font-semibold text-foreground">Temperature</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                How the water warms and cools below the surface.
              </p>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Salinity</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                How salt content varies through the ocean.
              </p>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Ocean profiles</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Measurements collected as floats travel through the water column.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}