/**
 * Landing interaction engine: pointer parallax, scroll progress, magnetic targets,
 * a cursor follower and touch ink. It writes CSS custom properties and the `translate`
 * property only, so React never re-renders per frame and the existing `transform`
 * animations on the same elements keep composing with it.
 *
 * Markup contract (all optional):
 * - `data-landing-track`  receives `--p`: 0 when its top enters the viewport bottom,
 *                         1 when its bottom leaves the viewport top; and `--exit`: the
 *                         share of its height already scrolled past the viewport top.
 * - `data-depth="n"`      shifts up to n px with the pointer; `data-scroll-depth="n"`
 *                         drifts n px across its nearest tracked ancestor's progress.
 * - `data-magnetic`       receives `--mag-x` / `--mag-y` while the pointer is over it.
 * - `data-cursor-label`   swaps the cursor follower into a label bubble.
 */

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const viewportProgress = (top: number, height: number, viewportHeight: number) =>
  clamp((viewportHeight - top) / Math.max(1, viewportHeight + height));

export const exitProgress = (top: number, height: number) => clamp(-top / Math.max(1, height));

/** Frame-rate independent easing towards a target; lambda is the settle speed per second. */
export const damp = (current: number, target: number, lambda: number, seconds: number) =>
  target + (current - target) * Math.exp(-lambda * seconds);

export const magneticOffset = (
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  x: number,
  y: number,
  strength = 0.3,
  limit = 14
) => ({
  x: clamp((x - (rect.left + rect.width / 2)) * strength, -limit, limit),
  y: clamp((y - (rect.top + rect.height / 2)) * strength, -limit, limit),
});

/** Advances a looping marquee; the returned offset always stays within (-loopWidth, 0]. */
export const marqueeOffset = (
  offset: number,
  speed: number,
  seconds: number,
  loopWidth: number
) => {
  if (loopWidth <= 0) return 0;
  const next = (offset - speed * seconds) % loopWidth;
  return next > 0 ? next - loopWidth : next;
};

const INTERACTIVE = 'a, button, [role="button"], input, select, textarea, label, summary';
const SETTLED = 0.05;
const MAX_INKS = 6;

interface DepthTarget {
  element: HTMLElement;
  depth: number;
  scrollDepth: number;
  anchor: HTMLElement | null;
}

export interface LandingMotionOptions {
  finePointer: boolean;
  cursor?: HTMLElement | null;
  inkLayer?: HTMLElement | null;
}

export function createLandingMotion(
  root: HTMLElement,
  { finePointer, cursor = null, inkLayer = null }: LandingMotionOptions
) {
  const tracked = Array.from(root.querySelectorAll<HTMLElement>('[data-landing-track]'));
  const depthTargets: DepthTarget[] = Array.from(
    root.querySelectorAll<HTMLElement>('[data-depth], [data-scroll-depth]')
  ).map((element) => ({
    element,
    depth: Number(element.dataset.depth) || 0,
    scrollDepth: Number(element.dataset.scrollDepth) || 0,
    anchor: element.parentElement?.closest<HTMLElement>('[data-landing-track]') ?? null,
  }));
  const progress = new Map<HTMLElement, number>();
  const exits = new Map<HTMLElement, number>();

  let frame = 0;
  let lastTime = 0;
  let pointerX = 0;
  let pointerY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let cursorX = -100;
  let cursorY = -100;
  let pointerSeen = false;
  let pointerTarget: Element | null = null;
  let magnet: HTMLElement | null = null;
  const inkTimers = new Set<number>();

  const setMagnet = (next: HTMLElement | null) => {
    if (magnet === next) return;
    if (magnet) {
      magnet.style.setProperty('--mag-x', '0px');
      magnet.style.setProperty('--mag-y', '0px');
      delete magnet.dataset.magnetActive;
    }
    magnet = next;
    if (magnet) magnet.dataset.magnetActive = 'true';
  };

  const render = (time: number) => {
    frame = 0;
    const seconds = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 1 / 60;
    lastTime = time;
    const viewportHeight = window.innerHeight || 1;
    const viewportWidth = window.innerWidth || 1;

    // Read every rect before writing any style so the frame never forces a second layout.
    for (const element of tracked) {
      const rect = element.getBoundingClientRect();
      progress.set(element, viewportProgress(rect.top, rect.height, viewportHeight));
      exits.set(element, exitProgress(rect.top, rect.height));
    }
    const rootRect = root.getBoundingClientRect();
    const pageProgress = clamp(-rootRect.top / Math.max(1, root.offsetHeight - viewportHeight));
    const magnetRect = magnet?.getBoundingClientRect();

    let moving = false;
    if (finePointer && pointerSeen) {
      const targetX = clamp((pointerX / viewportWidth) * 2 - 1, -1, 1);
      const targetY = clamp((pointerY / viewportHeight) * 2 - 1, -1, 1);
      parallaxX = damp(parallaxX, targetX, 5, seconds);
      parallaxY = damp(parallaxY, targetY, 5, seconds);
      cursorX = damp(cursorX, pointerX, 22, seconds);
      cursorY = damp(cursorY, pointerY, 22, seconds);
      moving =
        Math.abs(parallaxX - targetX) * 100 > SETTLED ||
        Math.abs(parallaxY - targetY) * 100 > SETTLED ||
        Math.abs(cursorX - pointerX) > SETTLED ||
        Math.abs(cursorY - pointerY) > SETTLED;
    }

    root.style.setProperty('--club-progress', pageProgress.toFixed(4));
    for (const [element, value] of progress) element.style.setProperty('--p', value.toFixed(4));
    for (const [element, value] of exits) element.style.setProperty('--exit', value.toFixed(4));
    for (const { element, depth, scrollDepth, anchor } of depthTargets) {
      const anchorProgress = anchor ? (progress.get(anchor) ?? 0.5) : 0.5;
      const x = parallaxX * depth;
      const y = parallaxY * depth + (anchorProgress - 0.5) * scrollDepth;
      element.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    }
    if (cursor && pointerSeen) {
      cursor.style.translate = `${cursorX.toFixed(1)}px ${cursorY.toFixed(1)}px`;
    }
    if (magnet && magnetRect) {
      const offset = magneticOffset(magnetRect, pointerX, pointerY);
      magnet.style.setProperty('--mag-x', `${offset.x.toFixed(2)}px`);
      magnet.style.setProperty('--mag-y', `${offset.y.toFixed(2)}px`);
    }

    if (moving) schedule();
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!pointerSeen) {
      pointerSeen = true;
      cursorX = pointerX;
      cursorY = pointerY;
      if (cursor) cursor.dataset.visible = 'true';
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target !== pointerTarget) {
      pointerTarget = target;
      const insideRoot = !!target && root.contains(target);
      setMagnet(insideRoot ? (target.closest<HTMLElement>('[data-magnetic]') ?? null) : null);
      if (cursor) {
        const labelled = insideRoot ? target.closest<HTMLElement>('[data-cursor-label]') : null;
        const interactive = target?.closest(INTERACTIVE);
        cursor.dataset.state = labelled ? 'label' : interactive ? 'link' : 'idle';
        const label = cursor.firstElementChild as HTMLElement | null;
        if (label) label.textContent = labelled?.dataset.cursorLabel ?? '';
      }
    }
    schedule();
  };

  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget) return;
    setMagnet(null);
    pointerTarget = null;
    if (cursor) cursor.dataset.visible = 'false';
    pointerSeen = false;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!inkLayer || event.pointerType === 'mouse') return;
    while (inkLayer.childElementCount >= MAX_INKS) inkLayer.firstElementChild?.remove();
    const ink = document.createElement('span');
    ink.className = 'club-touch-ink';
    ink.style.left = `${event.clientX}px`;
    ink.style.top = `${event.clientY}px`;
    inkLayer.appendChild(ink);
    // animationend never fires when the animation is suppressed, so a timer cleans up too.
    const timer = window.setTimeout(() => {
      inkTimers.delete(timer);
      ink.remove();
    }, 900);
    inkTimers.add(timer);
    ink.addEventListener('animationend', () => ink.remove(), { once: true });
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  if (finePointer) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerout', onPointerOut);
  }
  root.addEventListener('pointerdown', onPointerDown, { passive: true });
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerout', onPointerOut);
    root.removeEventListener('pointerdown', onPointerDown);
    inkTimers.forEach((timer) => window.clearTimeout(timer));
    inkLayer?.replaceChildren();
    setMagnet(null);
    root.style.removeProperty('--club-progress');
    tracked.forEach((element) => {
      element.style.removeProperty('--p');
      element.style.removeProperty('--exit');
    });
    depthTargets.forEach(({ element }) => element.style.removeProperty('translate'));
    if (cursor) {
      cursor.style.removeProperty('translate');
      cursor.dataset.visible = 'false';
    }
  };
}
