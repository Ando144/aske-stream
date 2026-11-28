/**
 * Controller of the opening screen drawn by index.html. All the movement lives in its CSS;
 * this only decides when the bars settle and when the screen goes away.
 */

export const BOOT_INTRO_MS = 1400;
export const SETTLE_MS = 480;
export const SETTLE_HOLD_MS = 120;
export const LEAVE_MS = 360;
// If the app is ready during the intro, leave just after it ends.
const INTRO_EXIT_GRACE_MS = 100;
// Fallbacks for when the browser never reports a frame or the end of a transition.
const FRAME_FALLBACK_MS = 100;
const LEAVE_FALLBACK_EXTRA_MS = 150;

// One settling per splash node, shared by every caller.
const settling = new WeakMap<HTMLElement, Promise<void>>();

export type SplashPhase = 'intro' | 'eq' | 'settling' | 'leaving' | 'gone';

export function splashPhaseAt(elapsedMs: number): 'intro' | 'eq' {
  return elapsedMs < BOOT_INTRO_MS ? 'intro' : 'eq';
}

function findSplash(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById('boot-splash');
}

function setPhase(splash: HTMLElement, phase: SplashPhase): void {
  splash.dataset.phase = phase;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Time since the animation started, delay included, so it matches what is on screen. */
function splashElapsedMs(splash: HTMLElement): number {
  const equalizer = splash
    .querySelector('.eq')
    ?.getAnimations?.()
    .find((animation) => (animation as CSSAnimation).animationName === 'boot-eq-1');
  return Number(equalizer?.currentTime ?? document.timeline?.currentTime ?? performance.now());
}

export function attachBootSplash(ariaLabel: string): void {
  const splash = findSplash();
  if (!splash) return;
  splash.setAttribute('aria-label', ariaLabel);
  const introLeftMs = Math.max(0, BOOT_INTRO_MS - splashElapsedMs(splash));
  setTimeout(() => {
    const calm = splash.classList.contains('calm');
    if (splash.dataset.phase === 'intro' && !calm) setPhase(splash, 'eq');
  }, introLeftMs);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const fallback = setTimeout(resolve, FRAME_FALLBACK_MS);
    requestAnimationFrame(() => {
      clearTimeout(fallback);
      resolve();
    });
  });
}

/** Freezes each bar where it is and eases it back to the shape of the logo. */
async function settleBars(splash: HTMLElement): Promise<void> {
  setPhase(splash, 'settling');
  const bars = Array.from(splash.querySelectorAll<SVGGElement>('.eq'));
  // Read every scale before touching any style, so all bars are sampled at the same instant.
  const scales = bars.map((bar) => getComputedStyle(bar).getPropertyValue('--s'));
  bars.forEach((bar, i) => {
    bar.style.setProperty('--s', scales[i] ?? '1');
    bar.classList.add('settling');
    // Forces a style update: the transition needs the frozen value as its starting point.
    void getComputedStyle(bar).getPropertyValue('--s');
  });
  await nextFrame();
  bars.forEach((bar) => bar.style.setProperty('--s', '1'));
  await wait(SETTLE_MS + SETTLE_HOLD_MS);
}

async function settle(splash: HTMLElement): Promise<void> {
  const elapsedMs = splashElapsedMs(splash);
  if (splashPhaseAt(elapsedMs) === 'intro') {
    // Dropped now, while every bar still has its own height: the equalizer never starts.
    splash.classList.add('calm');
    await wait(BOOT_INTRO_MS + INTRO_EXIT_GRACE_MS - elapsedMs);
    return;
  }
  await settleBars(splash);
  splash.classList.add('calm');
}

export function settleBootSplash(): Promise<void> {
  const splash = findSplash();
  if (!splash) return Promise.resolve();
  const pending = settling.get(splash) ?? settle(splash);
  settling.set(splash, pending);
  return pending;
}

function fadeOut(splash: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(fallback);
      splash.removeEventListener('transitionend', onTransitionEnd);
      setPhase(splash, 'gone');
      splash.remove();
      resolve();
    };
    // The logo has its own transition, which bubbles up and must not end the fade early.
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === splash && event.propertyName === 'opacity') finish();
    };
    const fallback = setTimeout(finish, LEAVE_MS + LEAVE_FALLBACK_EXTRA_MS);
    splash.addEventListener('transitionend', onTransitionEnd);
    setPhase(splash, 'leaving');
  });
}

/** Fades the screen out once the bars have settled, then removes it. */
export async function leaveBootSplash(): Promise<void> {
  const splash = findSplash();
  if (!splash) return;
  await settleBootSplash();
  await fadeOut(splash);
}
