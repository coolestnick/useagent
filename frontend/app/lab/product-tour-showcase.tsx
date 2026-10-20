"use client";

import { Button } from "@/components/base/buttons/button";
import { TourOfferCard, TourStepCard } from "@/components/shell/product-tour-overlay";
import { startTour } from "@/lib/product-tour";
import { visibleTourSteps } from "@/lib/product-tour-steps";

const STEPS = visibleTourSteps({ bots: true });
const noop = () => {};

/** The tour's two cards with the real step copy, and the live tour on this page's rail. */
export function ProductTourShowcase() {
  const dashboard = STEPS.find((step) => step.id === "dashboard");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <TourOfferCard onStart={noop} onDecline={noop} />
        {dashboard ? (
          <div className="w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-dropdown">
            <TourStepCard
              step={dashboard}
              index={STEPS.indexOf(dashboard)}
              total={STEPS.length}
              showPage
              onBack={noop}
              onNext={noop}
              onClose={noop}
            />
          </div>
        ) : null}
      </div>
      <div>
        <Button variant="secondary" size="xs" onClick={() => startTour(null)}>
          Run the tour on this page
        </Button>
      </div>
    </div>
  );
}
