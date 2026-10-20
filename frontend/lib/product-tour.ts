/**
 * The product tour: a short, skippable walk through the main parts of the app
 * for a person who has just signed up. It is offered once per person per
 * browser (never forced), can be restarted from the account menu, and every
 * step names the page it describes. Steps point at elements carrying a
 * `data-tour-target` attribute; a step whose element is not on screen (a
 * folded mobile rail, another layout) shows its card without a highlight.
 *
 * The state lives in this module, not in a component, so the tour survives a
 * client-side navigation between layouts (each layout mounts its own shell).
 * Only this store ships with the shell; the steps, their placement and the
 * cards (`product-tour-steps.ts`, `components/shell/product-tour-overlay.tsx`)
 * load when the tour is offered or started.
 */

export type TourState =
  | { readonly phase: "idle" }
  | { readonly phase: "offer"; readonly userId: string }
  /** stepId null: the first step the deployment shows. */
  | { readonly phase: "touring"; readonly userId: string | null; readonly stepId: string | null };

const IDLE: TourState = { phase: "idle" };
let state: TourState = IDLE;
const listeners = new Set<() => void>();

function setState(next: TourState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeTour(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function tourSnapshot(): TourState {
  return state;
}

export function tourServerSnapshot(): TourState {
  return IDLE;
}

const seenKey = (userId: string) => `product-tour-seen:${userId}`;
/** Held for the page's lifetime too, so a browser that refuses storage does not
 *  offer the tour again on every client-side visit to the composer. */
const seenHere = new Set<string>();

/** Per browser: a person who finished or declined the tour is not offered it again. */
export function tourSeen(userId: string): boolean {
  if (seenHere.has(userId)) return true;
  try {
    return window.localStorage.getItem(seenKey(userId)) !== null;
  } catch {
    return false;
  }
}

function markTourSeen(userId: string, outcome: "completed" | "dismissed"): void {
  seenHere.add(userId);
  try {
    window.localStorage.setItem(seenKey(userId), outcome);
  } catch {
    // A browser that refuses storage may offer the tour again after a full reload; nothing else depends on it.
  }
}

/** Offer the tour (a small card the person accepts or declines). Only from rest,
 *  and never to someone who already finished or declined it here. */
export function offerTour(userId: string): void {
  if (state.phase !== "idle" || tourSeen(userId)) return;
  setState({ phase: "offer", userId });
}

/** Start at the first step: from the offer, or from the account menu at any time. */
export function startTour(userId: string | null): void {
  setState({ phase: "touring", userId, stepId: null });
}

/** Move to another step of the visible list (ids in order); past the last one the tour completes. */
export function goToStep(steps: readonly { readonly id: string }[], direction: 1 | -1): void {
  if (state.phase !== "touring") return;
  const current = state.stepId;
  const index = steps.findIndex((step) => step.id === current);
  const next = steps[(index < 0 ? 0 : index) + direction];
  if (!next) {
    if (direction === 1) finishTour("completed");
    return;
  }
  setState({ ...state, stepId: next.id });
}

/** End the tour or the offer and remember it for this person in this browser. */
export function finishTour(outcome: "completed" | "dismissed"): void {
  if (state.phase === "idle") return;
  if (state.userId) markTourSeen(state.userId, outcome);
  setState(IDLE);
}

/** Tests only: back to rest with nothing remembered. */
export function resetTourForTests(): void {
  seenHere.clear();
  setState(IDLE);
}
