"use client";

import { RiArrowRightUpLine, RiCloseLine, RiCompass3Line } from "@remixicon/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/base/buttons/button";
import { useCapabilityCatalog } from "@/hooks/use-capability-catalog";
import { finishTour, goToStep, startTour, type TourState } from "@/lib/product-tour";
import {
  onStepPage,
  placeTourCard,
  type TourPlacement,
  type TourRect,
  type TourStep,
  visibleTourSteps,
} from "@/lib/product-tour-steps";
import { cx } from "@/utils/cx";

const CARD =
  "w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-dropdown";
/** Enter: opacity and a small scale from 0.95, on the shared ease-out curve; none under reduced motion. */
const ENTER =
  "animate-in fade-in-0 zoom-in-95 duration-200 ease-(--ease-out) motion-reduce:animate-none";

/** Surfaces that answer Escape themselves; the tour's own card is not one of them. */
const OTHER_SURFACE = '[role="menu"], [role="listbox"], [role="dialog"]:not([data-product-tour])';

/** Longer than the enter animation: when it does not run (reduced motion), focus moves anyway. */
const FOCUS_FALLBACK_MS = 260;

/**
 * The offer: a small card in the corner that never blocks the page. Declining
 * is remembered, and the account menu still offers the tour later.
 */
export function TourOfferCard({
  onStart,
  onDecline,
}: {
  onStart: () => void;
  onDecline: () => void;
}) {
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-live="polite"
      aria-labelledby="product-tour-offer-title"
      aria-describedby="product-tour-offer-body"
      className={CARD}
    >
      <div className="flex items-start gap-3">
        <RiCompass3Line className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="product-tour-offer-title" className="text-body-2-medium text-text-primary">
            Welcome to UseAgent
          </h2>
          <p id="product-tour-offer-body" className="mt-1 text-body-2-regular text-text-secondary">
            Take a quick tour of the main parts of the app. It takes about a minute.
          </p>
          <p className="mt-1 text-caption-1-regular text-text-tertiary">
            You can start it any time from the account menu.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={onDecline}>
          Not now
        </Button>
        <Button variant="primary" size="xs" onClick={onStart}>
          Start tour
        </Button>
      </div>
    </section>
  );
}

/** One step: where it is in the tour, what the highlighted part does, the page it describes, and the way on. */
export function TourStepCard({
  step,
  index,
  total,
  showPage,
  headingRef,
  onBack,
  onNext,
  onClose,
}: {
  step: TourStep;
  index: number;
  total: number;
  /** False on the step's own page, where a link to it would go nowhere. */
  showPage: boolean;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const last = index === total - 1;
  return (
    <>
      <div className="flex items-center gap-2">
        {/* Progress at a glance; the count beside it is what assistive tech reads. */}
        <div className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: total }, (_, n) => n).map((n) => (
            <span
              key={n}
              className={cx(
                "h-1.5 rounded-full",
                n === index
                  ? "w-3 bg-foreground-icon-primary"
                  : "w-1.5 bg-foreground-icon-tertiary",
              )}
            />
          ))}
        </div>
        <p className="min-w-0 flex-1 text-caption-1-regular tabular-nums text-text-tertiary">
          {index + 1} of {total}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tour"
          className="-mr-1 rounded-md p-1 text-text-tertiary transition-colors hover:bg-background-primary-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RiCloseLine className="size-4" aria-hidden />
        </button>
      </div>
      <h2
        ref={headingRef}
        id="product-tour-step-title"
        tabIndex={-1}
        className="mt-1 text-body-2-medium text-text-primary outline-none"
      >
        {step.title}
      </h2>
      <p id="product-tour-step-body" className="mt-1 text-body-2-regular text-text-secondary">
        {step.body}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {showPage && step.page ? (
          <Link
            href={step.page.href}
            className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border-button-default px-2.5 py-1 text-caption-1-medium text-text-primary transition-colors hover:bg-background-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <span className="truncate">Open {step.page.label}</span>
            <RiArrowRightUpLine className="size-3.5 shrink-0" aria-hidden />
          </Link>
        ) : null}
        <span className="flex-1" />
        {index > 0 ? (
          <Button variant="ghost" size="xs" onClick={onBack}>
            Back
          </Button>
        ) : null}
        <Button variant="primary" size="xs" onClick={onNext}>
          {last ? "Done" : "Next"}
        </Button>
      </div>
    </>
  );
}

/**
 * The on-screen rectangle of the element a step points at, kept current while
 * the page scrolls, resizes or navigates. Null while it is not on screen.
 *
 * The element can arrive well after the page (the provider panels wait for
 * their data) or be replaced (a refresh re-renders them), so while it is
 * missing every change to the page looks for it again, for as long as the
 * step is open.
 */
function useTourTarget(name: string | undefined, pathname: string | null): TourRect | null {
  const [rect, setRect] = useState<TourRect | null>(null);
  useEffect(() => {
    setRect(null);
    if (!name || pathname === null) return;
    const selector = `[data-tour-target="${name}"]`;
    let element: Element | null = null;
    let scrolled = false;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resized = new ResizeObserver(schedule);
    function measure() {
      if (!element?.isConnected) {
        resized.disconnect();
        element = document.querySelector(selector);
        if (element) {
          resized.observe(element);
          // Brought into view once per step, not again on every re-render.
          if (!scrolled) element.scrollIntoView({ block: "nearest", inline: "nearest" });
          scrolled = true;
        }
      }
      const box = element?.getBoundingClientRect();
      setRect(
        box && box.width > 0 && box.height > 0
          ? { top: box.top, left: box.left, width: box.width, height: box.height }
          : null,
      );
    }
    const changed = new MutationObserver(() => {
      if (!element?.isConnected) schedule();
    });
    changed.observe(document.body, { childList: true, subtree: true });
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      changed.disconnect();
      resized.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [name, pathname]);
  return rect;
}

/** Room between the highlighted element and its outline. */
const HOLE_PAD = 4;

/** The arrow on the card's edge that faces the target, drawn as a turned square
 *  whose two outer sides carry the card's border. */
const ARROW_EDGE: Record<Exclude<TourPlacement["side"], "floating">, string> = {
  right: "-left-1.5 border-b border-l",
  left: "-right-1.5 border-t border-r",
  bottom: "-top-1.5 border-t border-l",
  top: "-bottom-1.5 border-r border-b",
};

function arrowStyle(placement: TourPlacement): CSSProperties | undefined {
  if (placement.arrow === null) return undefined;
  const along = placement.arrow - 6;
  return placement.side === "right" || placement.side === "left" ? { top: along } : { left: along };
}

/** The card grows out of its arrow, so it reads as coming from the target. */
function cardOrigin(placement: TourPlacement): string {
  const at = placement.arrow ?? 0;
  if (placement.side === "right") return `0 ${at}px`;
  if (placement.side === "left") return `100% ${at}px`;
  if (placement.side === "bottom") return `${at}px 0`;
  if (placement.side === "top") return `${at}px 100%`;
  return "50% 100%";
}

/**
 * The dimmed page around the highlighted element. Clicking the dimmed part
 * closes the tour (as in most product tours); the highlighted element itself
 * stays usable, so the composer can be typed in and a rail row followed.
 */
function TourBackdrop({ hole, onDismiss }: { hole: TourRect | null; onDismiss: () => void }) {
  if (!hole) {
    return (
      <div
        aria-hidden
        onClick={onDismiss}
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0 duration-200 ease-(--ease-out) motion-reduce:animate-none"
      />
    );
  }
  const bottom = hole.top + hole.height;
  const right = hole.left + hole.width;
  // Four click areas around the hole; the dimming itself is the outline's
  // spread shadow, which keeps the hole's corners round.
  const areas: CSSProperties[] = [
    { top: 0, left: 0, right: 0, height: Math.max(0, hole.top) },
    { top: bottom, left: 0, right: 0, bottom: 0 },
    { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height },
    { top: hole.top, left: right, right: 0, height: hole.height },
  ];
  return (
    <>
      {areas.map((style, n) => (
        <div
          key={["above", "below", "before", "after"][n]}
          aria-hidden
          onClick={onDismiss}
          className="fixed z-50"
          style={style}
        />
      ))}
      <div
        aria-hidden
        className="pointer-events-none fixed z-50 rounded-xl ring-2 ring-border-focus-ring shadow-[0_0_0_100vmax_black] shadow-black/50 animate-in fade-in-0 duration-200 ease-(--ease-out) motion-reduce:animate-none"
        style={hole}
      />
    </>
  );
}

function TourSteps({ stepId }: { stepId: string | null }) {
  const { catalog, loaded } = useCapabilityCatalog();
  const steps = visibleTourSteps({ bots: catalog?.bots === true });
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === stepId),
  );
  const step = steps[index];
  const pathname = usePathname();
  const router = useRouter();
  const target = useTourTarget(step?.target, pathname);
  const cardRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const [card, setCard] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  // Re-measured per step (a new step can change the card's height) and once
  // the catalog answers, as the card is not drawn before that.
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const measure = () => setCard({ width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [step?.id, loaded]);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // A step that points at something only its page has opens that page when
  // the person reaches it (Next or Back), once: keyed on the step alone, so
  // leaving the page again later is their call.
  useEffect(() => {
    if (step?.opensPage && step.page && !onStepPage(step, pathname)) router.push(step.page.href);
  }, [step?.id]);

  // Escape closes the tour wherever focus is, except where another menu,
  // list, dialog or open popup (a composer suggestion list keeps focus in the
  // text box, which reports it as expanded) is the key's to answer. The arrow
  // keys walk the steps while focus is in the card.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const from = event.target instanceof Element ? event.target : null;
      if (event.key === "Escape") {
        if (from?.closest(OTHER_SURFACE) || from?.closest('[aria-expanded="true"]')) return;
        finishTour("dismissed");
        return;
      }
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      if (!from?.closest("[data-product-tour]")) return;
      event.preventDefault();
      goToStep(stepsRef.current, event.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus follows the step, so a screen reader reads each one (and Escape
  // reaches the card). Not before the card is measured (it is hidden until
  // placed) and not while its enter animation is still at zero opacity, which
  // the browser refuses to focus: the animation's end hands focus over, and a
  // timer covers reduced motion, where nothing animates.
  const measured = card !== null;
  const focusPending = useRef(false);
  const focusHeading = () => {
    if (!focusPending.current) return;
    focusPending.current = false;
    headingRef.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!measured) return;
    focusPending.current = true;
    const timer = window.setTimeout(focusHeading, FOCUS_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [step?.id, measured]);

  // Until the catalog answers, the step count (Bots or not) is unknown: wait
  // rather than show "of 9" and change it to "of 10".
  if (!step || !loaded) return null;
  const placement = card ? placeTourCard(target, card, viewport) : null;
  const hole = target
    ? {
        top: target.top - HOLE_PAD,
        left: target.left - HOLE_PAD,
        width: target.width + HOLE_PAD * 2,
        height: target.height + HOLE_PAD * 2,
      }
    : null;
  const dismiss = () => finishTour("dismissed");
  return (
    <>
      <TourBackdrop hole={hole} onDismiss={dismiss} />
      <section
        key={step.id}
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        data-product-tour
        aria-labelledby="product-tour-step-title"
        aria-describedby="product-tour-step-body"
        onAnimationEnd={focusHeading}
        className={`fixed z-50 ${CARD} ${ENTER}`}
        style={
          placement
            ? { top: placement.top, left: placement.left, transformOrigin: cardOrigin(placement) }
            : { top: 0, left: 0, visibility: "hidden" }
        }
      >
        {placement && placement.side !== "floating" ? (
          <span
            aria-hidden
            className={`absolute size-3 rotate-45 border-border-button-default bg-background-primary-default ${ARROW_EDGE[placement.side]}`}
            style={arrowStyle(placement)}
          />
        ) : null}
        <TourStepCard
          step={step}
          index={index}
          total={steps.length}
          showPage={step.page !== undefined && !onStepPage(step, pathname)}
          headingRef={headingRef}
          onBack={() => goToStep(steps, -1)}
          onNext={() => goToStep(steps, 1)}
          onClose={dismiss}
        />
      </section>
    </>
  );
}

export function ProductTourOverlay({ state }: { state: Exclude<TourState, { phase: "idle" }> }) {
  if (state.phase === "offer") {
    return (
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex justify-end sm:inset-x-auto sm:right-4 sm:bottom-4">
        <div className={`pointer-events-auto ${ENTER}`}>
          <TourOfferCard
            onStart={() => startTour(state.userId)}
            onDecline={() => finishTour("dismissed")}
          />
        </div>
      </div>
    );
  }
  return <TourSteps stepId={state.stepId} />;
}
