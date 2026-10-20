/**
 * The product tour's steps and where each card goes. Loaded with the tour's
 * cards, never with the shell (see `product-tour.ts` for the state).
 */

export interface TourStep {
  readonly id: string;
  /** The `data-tour-target` value of the element the step highlights. */
  readonly target: string;
  readonly title: string;
  readonly body: string;
  /** The page the step describes, offered as a link when it is not the current page. */
  readonly page?: { readonly href: string; readonly label: string };
  /** Shown only when the deployment offers the feature (the rail hides it otherwise). */
  readonly requires?: "bots";
  /** The step points at something only its page has, so reaching the step opens that page. */
  readonly opensPage?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "composer",
    target: "composer",
    title: "Start with a task",
    body: "Describe what you want done and pick an engine. UseAgent works on it in its own sandbox and shows every step.",
    page: { href: "/agent/new", label: "New thread" },
  },
  {
    id: "new-thread",
    target: "nav-new",
    title: "New thread",
    body: "Start a fresh thread any time. Each thread keeps its own files and history, so you can reply later to continue.",
    page: { href: "/agent/new", label: "New thread" },
  },
  {
    id: "dashboard",
    target: "nav-dashboard",
    title: "Dashboard",
    body: "See what is running, what finished and what needs your attention across the workspace.",
    page: { href: "/dashboard", label: "Dashboard" },
  },
  {
    id: "bots",
    target: "nav-bots",
    title: "Bots",
    body: "Set up helpers with their own instructions, then hand them work with an @mention.",
    page: { href: "/bots", label: "Bots" },
    requires: "bots",
  },
  {
    id: "customize",
    target: "nav-customize",
    title: "Customize",
    body: "Add skills, playbooks, automations and knowledge that shape how your agents work.",
    page: { href: "/skills", label: "Customize" },
  },
  {
    id: "library",
    target: "nav-library",
    title: "Library",
    body: "Find the artifacts, tasks and memory your agents produced, and the secrets they can use.",
    page: { href: "/artifacts", label: "Library" },
  },
  {
    id: "account",
    target: "account",
    title: "Your account",
    body: "Switch workspace, open Settings or take this tour again. Next: connect a model so your agents can work.",
    page: { href: "/settings", label: "Settings" },
  },
  {
    id: "connect",
    target: "settings-providers",
    title: "Connect a model",
    body: "Agents need an AI model account. Connect at least one here. A provider marked Provided by this deployment already works, so you can skip it.",
    page: { href: "/settings#providers", label: "Providers" },
    opensPage: true,
  },
  {
    id: "connect-subscription",
    target: "provider-openai",
    title: "Codex: your ChatGPT plan",
    body: "Under OpenAI, press Connect with ChatGPT. Copy the code it shows, finish signing in on the OpenAI page, and the status turns Connected. Or paste an OpenAI API key and press Save key.",
    page: { href: "/settings#providers", label: "Providers" },
    opensPage: true,
  },
  {
    id: "connect-api-key",
    target: "provider-anthropic",
    title: "Claude Code: an API key",
    body: "Under Anthropic, paste an API key from your Anthropic account and press Save key. Keys are write-only and never shown again. For free models, add an OpenRouter key the same way.",
    page: { href: "/settings#providers", label: "Providers" },
    opensPage: true,
  },
];

/** Whether the person is on the page a step describes (its href may carry a #section). */
export function onStepPage(step: TourStep, pathname: string | null): boolean {
  return step.page !== undefined && step.page.href.split("#")[0] === pathname;
}

/** The steps this deployment can show, in order. */
export function visibleTourSteps(features: { readonly bots: boolean }): readonly TourStep[] {
  return TOUR_STEPS.filter((step) => step.requires !== "bots" || features.bots);
}

export interface TourRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface TourPlacement {
  readonly top: number;
  readonly left: number;
  readonly side: "right" | "bottom" | "top" | "left" | "floating";
  /** Where the card's arrow meets the edge facing the target, measured along
   *  that edge from its start (top or left); null for a floating card. */
  readonly arrow: number | null;
}

const GAP = 12;
const MARGIN = 12;
/** The arrow keeps clear of the card's rounded corners. */
const ARROW_INSET = 16;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Where the step card goes: beside its target (right first, as the rail's rows
 * sit on the left, then below, above and left), kept inside the viewport, with
 * its arrow pointing at the target's centre. With no target on screen the card
 * floats at the bottom centre.
 */
export function placeTourCard(
  target: TourRect | null,
  card: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
): TourPlacement {
  const centredLeft = clamp(
    (viewport.width - card.width) / 2,
    MARGIN,
    viewport.width - card.width - MARGIN,
  );
  const floating: TourPlacement = {
    side: "floating",
    left: centredLeft,
    top: clamp(viewport.height - card.height - 24, MARGIN, viewport.height - card.height - MARGIN),
    arrow: null,
  };
  if (!target || target.width <= 0 || target.height <= 0) return floating;

  const right = target.left + target.width;
  const bottom = target.top + target.height;
  const centreY = target.top + target.height / 2;
  const centreX = target.left + target.width / 2;
  const alongY = clamp(centreY - card.height / 2, MARGIN, viewport.height - card.height - MARGIN);
  const alongX = clamp(centreX - card.width / 2, MARGIN, viewport.width - card.width - MARGIN);
  const arrowY = clamp(centreY - alongY, ARROW_INSET, card.height - ARROW_INSET);
  const arrowX = clamp(centreX - alongX, ARROW_INSET, card.width - ARROW_INSET);

  if (right + GAP + card.width <= viewport.width - MARGIN)
    return { side: "right", left: right + GAP, top: alongY, arrow: arrowY };
  if (bottom + GAP + card.height <= viewport.height - MARGIN)
    return { side: "bottom", left: alongX, top: bottom + GAP, arrow: arrowX };
  if (target.top - GAP - card.height >= MARGIN)
    return { side: "top", left: alongX, top: target.top - GAP - card.height, arrow: arrowX };
  if (target.left - GAP - card.width >= MARGIN)
    return { side: "left", left: target.left - GAP - card.width, top: alongY, arrow: arrowY };
  return floating;
}
