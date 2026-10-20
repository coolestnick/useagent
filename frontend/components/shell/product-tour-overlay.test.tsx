import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { visibleTourSteps } from "@/lib/product-tour-steps";
import { TourOfferCard, TourStepCard } from "./product-tour-overlay";

const noop = () => {};

test("the offer explains itself, can be declined, and says where to find the tour later", () => {
  const html = renderToStaticMarkup(<TourOfferCard onStart={noop} onDecline={noop} />);
  expect(html).toContain("Welcome to UseAgent");
  expect(html).toContain("Start tour");
  expect(html).toContain("Not now");
  expect(html).toContain("account menu");
  // Non-modal: the page behind stays usable.
  expect(html).toContain('aria-modal="false"');
});

test("a step names its place in the tour and links to the page it describes", () => {
  const steps = visibleTourSteps({ bots: false });
  const dashboard = steps.find((step) => step.id === "dashboard");
  if (!dashboard) throw new Error("dashboard step missing");
  const html = renderToStaticMarkup(
    <TourStepCard
      step={dashboard}
      index={2}
      total={steps.length}
      showPage
      onBack={noop}
      onNext={noop}
      onClose={noop}
    />,
  );
  expect(html).toContain(`3 of ${steps.length}`);
  expect(html).toContain("Dashboard");
  expect(html).toContain('href="/dashboard"');
  expect(html).toContain("Open Dashboard");
  expect(html).toContain("Back");
  expect(html).toContain("Next");
  expect(html).toContain('aria-label="Close tour"');
});

test("the first step has no Back, the last says Done, and a step on its own page has no link to it", () => {
  const steps = visibleTourSteps({ bots: false });
  const [first] = steps;
  const last = steps[steps.length - 1];
  if (!first || !last) throw new Error("steps missing");
  const firstHtml = renderToStaticMarkup(
    <TourStepCard
      step={first}
      index={0}
      total={steps.length}
      showPage={false}
      onBack={noop}
      onNext={noop}
      onClose={noop}
    />,
  );
  expect(firstHtml).not.toContain(">Back<");
  expect(firstHtml).toContain(">Next<");
  expect(firstHtml).not.toContain("Open ");

  const lastHtml = renderToStaticMarkup(
    <TourStepCard
      step={last}
      index={steps.length - 1}
      total={steps.length}
      showPage={false}
      onBack={noop}
      onNext={noop}
      onClose={noop}
    />,
  );
  expect(lastHtml).toContain(">Done<");
  expect(lastHtml).not.toContain("Open Providers");
});

test("progress dots show every step and mark the current one, hidden from assistive tech", () => {
  const steps = visibleTourSteps({ bots: false });
  const [first] = steps;
  if (!first) throw new Error("steps missing");
  const html = renderToStaticMarkup(
    <TourStepCard
      step={first}
      index={3}
      total={steps.length}
      showPage={false}
      onBack={noop}
      onNext={noop}
      onClose={noop}
    />,
  );
  const dots: string[] = Array.from(
    html.matchAll(/<span class="h-1\.5 rounded-full[^"]*"/g),
    (match) => match[0],
  );
  expect(dots).toHaveLength(steps.length);
  expect(dots.filter((dot) => dot.includes("w-3"))).toHaveLength(1);
  expect(dots.findIndex((dot) => dot.includes("w-3"))).toBe(3);
  expect(html).toContain('<div class="flex items-center gap-1" aria-hidden="true">');
});
