"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";
import { subscribeTour, tourServerSnapshot, tourSnapshot } from "@/lib/product-tour";

/** The cards and highlight load only when the tour is offered or running, so
 *  the shell's first load carries none of it for everyone else. */
const ProductTourOverlay = lazy(() =>
  import("./product-tour-overlay").then((mod) => ({ default: mod.ProductTourOverlay })),
);

/** Mounted once per shell: renders nothing unless the tour is offered or running. */
export function ProductTour() {
  const state = useSyncExternalStore(subscribeTour, tourSnapshot, tourServerSnapshot);
  if (state.phase === "idle") return null;
  return (
    <Suspense fallback={null}>
      <ProductTourOverlay state={state} />
    </Suspense>
  );
}
