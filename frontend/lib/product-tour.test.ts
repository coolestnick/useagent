import {
  finishTour,
  goToStep,
  offerTour,
  resetTourForTests,
  startTour,
  subscribeTour,
  tourSeen,
  tourSnapshot,
} from "./product-tour";
import { onStepPage, placeTourCard, TOUR_STEPS, visibleTourSteps } from "./product-tour-steps";

const globals = globalThis as { window?: unknown };
let store: Map<string, string>;

beforeEach(() => {
  resetTourForTests();
  store = new Map();
  globals.window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  };
});

afterEach(() => {
  delete globals.window;
  resetTourForTests();
});

test("every step points at a target, and none of the copy uses an em dash", () => {
  const ids = new Set<string>();
  for (const step of TOUR_STEPS) {
    expect(step.target.length).toBeGreaterThan(0);
    expect(ids.has(step.id)).toBe(false);
    ids.add(step.id);
    expect(`${step.title} ${step.body} ${step.page?.label ?? ""}`).not.toContain("—");
  }
});

test("the setup steps open Settings at Providers and point at each provider's own panel", () => {
  const byId = new Map(TOUR_STEPS.map((step) => [step.id, step]));
  for (const id of ["connect", "connect-subscription", "connect-api-key"]) {
    const step = byId.get(id);
    expect(step?.opensPage).toBe(true);
    expect(step?.page?.href).toBe("/settings#providers");
  }
  expect(byId.get("connect")?.target).toBe("settings-providers");
  expect(byId.get("connect-subscription")?.target).toBe("provider-openai");
  expect(byId.get("connect-api-key")?.target).toBe("provider-anthropic");
  // The copy names the controls exactly as Settings labels them.
  expect(byId.get("connect-subscription")?.body).toContain("Connect with ChatGPT");
  expect(byId.get("connect-api-key")?.body).toContain("Save key");
  expect(byId.get("connect")?.body).toContain("Provided by this deployment");
});

test("a step's page counts as the current one whatever #section its link carries", () => {
  const connect = TOUR_STEPS.find((step) => step.id === "connect");
  const dashboard = TOUR_STEPS.find((step) => step.id === "dashboard");
  if (!connect || !dashboard) throw new Error("steps missing");
  expect(onStepPage(connect, "/settings")).toBe(true);
  expect(onStepPage(connect, "/agent/new")).toBe(false);
  expect(onStepPage(dashboard, "/dashboard")).toBe(true);
  expect(onStepPage(dashboard, null)).toBe(false);
});

test("the Bots step shows only where the deployment offers bots, like the rail", () => {
  expect(visibleTourSteps({ bots: false }).map((step) => step.id)).toEqual([
    "composer",
    "new-thread",
    "dashboard",
    "customize",
    "library",
    "account",
    "connect",
    "connect-subscription",
    "connect-api-key",
  ]);
  expect(visibleTourSteps({ bots: true }).map((step) => step.id)).toContain("bots");
});

test("the offer is made once: declining is remembered for that person in this browser", () => {
  offerTour("u1");
  expect(tourSnapshot()).toEqual({ phase: "offer", userId: "u1" });
  finishTour("dismissed");
  expect(tourSnapshot()).toEqual({ phase: "idle" });
  expect(store.get("product-tour-seen:u1")).toBe("dismissed");
  expect(tourSeen("u1")).toBe(true);

  offerTour("u1");
  expect(tourSnapshot()).toEqual({ phase: "idle" });
  // Someone else on the same browser is still offered it.
  offerTour("u2");
  expect(tourSnapshot()).toEqual({ phase: "offer", userId: "u2" });
});

test("a browser that refuses storage still does not offer the tour twice on one page", () => {
  globals.window = {
    localStorage: {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    },
  };
  offerTour("u1");
  expect(() => finishTour("dismissed")).not.toThrow();
  offerTour("u1");
  expect(tourSnapshot()).toEqual({ phase: "idle" });
});

test("an offer never interrupts a tour that is already running", () => {
  startTour("u1");
  offerTour("u1");
  expect(tourSnapshot()).toMatchObject({ phase: "touring", stepId: null });
});

test("walking the tour: next and back follow the visible steps, and finishing remembers it", () => {
  const steps = visibleTourSteps({ bots: false });
  const seen: string[] = [];
  const stop = subscribeTour(() => {
    const state = tourSnapshot();
    seen.push(state.phase === "touring" ? (state.stepId ?? "first") : state.phase);
  });
  startTour("u1");
  goToStep(steps, -1); // back on the first step stays put
  goToStep(steps, 1);
  goToStep(steps, 1); // dashboard, then customize: the hidden bots step is skipped
  goToStep(steps, 1);
  goToStep(steps, -1);
  for (let i = 0; i < steps.length; i += 1) goToStep(steps, 1);
  stop();
  expect(seen).toEqual([
    "first",
    "new-thread",
    "dashboard",
    "customize",
    "dashboard",
    "customize",
    "library",
    "account",
    "connect",
    "connect-subscription",
    "connect-api-key",
    "idle",
  ]);
  expect(store.get("product-tour-seen:u1")).toBe("completed");
});

test("a tour started from the menu while signed out remembers nothing and still closes", () => {
  startTour(null);
  finishTour("dismissed");
  expect(tourSnapshot()).toEqual({ phase: "idle" });
  expect(store.size).toBe(0);
});

const card = { width: 320, height: 160 };
const viewport = { width: 1280, height: 800 };

test("the card sits to the right of a rail row, vertically centred on it, its arrow at the row", () => {
  const row = { top: 200, left: 8, width: 240, height: 32 };
  expect(placeTourCard(row, card, viewport)).toEqual({
    side: "right",
    left: 260,
    top: 136,
    arrow: 80,
  });
});

test("with no room on the right the card goes below, then above, and stays inside the viewport", () => {
  const wide = { top: 100, left: 200, width: 900, height: 200 };
  expect(placeTourCard(wide, card, viewport)).toEqual({
    side: "bottom",
    left: 490,
    top: 312,
    arrow: 160,
  });
  const low = { top: 560, left: 200, width: 900, height: 200 };
  expect(placeTourCard(low, card, viewport)).toEqual({
    side: "top",
    left: 490,
    top: 388,
    arrow: 160,
  });
  const edge = { top: 400, left: 1200, width: 70, height: 30 };
  const placed = placeTourCard(edge, card, viewport);
  expect(placed.left + card.width).toBeLessThanOrEqual(viewport.width - 12);
});

test("the arrow keeps clear of the card's corners when the target sits near the screen's edge", () => {
  // A rail row at the very top: the card is pushed down to the margin, so the
  // row's centre is above the card and the arrow stops at the top inset.
  const top = placeTourCard({ top: 0, left: 8, width: 240, height: 8 }, card, viewport);
  expect(top.side).toBe("right");
  expect(top.arrow).toBe(16);
  const bottom = placeTourCard({ top: 790, left: 8, width: 240, height: 8 }, card, viewport);
  expect(bottom.arrow).toBe(card.height - 16);
});

test("a target that is missing or not laid out gets a floating card at the bottom centre", () => {
  const floating = { side: "floating", left: 480, top: 616, arrow: null };
  expect(placeTourCard(null, card, viewport)).toEqual(floating);
  expect(placeTourCard({ top: 0, left: 0, width: 0, height: 0 }, card, viewport)).toEqual(floating);
});

test("on a phone-sized screen the card never leaves the viewport", () => {
  const phone = { width: 360, height: 640 };
  const narrow = { width: 336, height: 180 };
  const placed = placeTourCard({ top: 100, left: 16, width: 328, height: 300 }, narrow, phone);
  expect(placed.left).toBeGreaterThanOrEqual(12);
  expect(placed.left + narrow.width).toBeLessThanOrEqual(phone.width - 12);
  expect(placed.top).toBeGreaterThanOrEqual(12);
  expect(placed.top + narrow.height).toBeLessThanOrEqual(phone.height - 12);
});
