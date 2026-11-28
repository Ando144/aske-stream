import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOT_INTRO_MS,
  LEAVE_MS,
  attachBootSplash,
  leaveBootSplash,
  settleBootSplash,
  splashPhaseAt,
} from '../src/lib/bootSplash';

describe('splashPhaseAt', () => {
  it('is the intro until the intro time has passed', () => {
    expect(BOOT_INTRO_MS).toBe(1400);
    expect(splashPhaseAt(0)).toBe('intro');
    expect(splashPhaseAt(1399)).toBe('intro');
  });

  it('is the equalizer from the end of the intro on', () => {
    expect(splashPhaseAt(1400)).toBe('eq');
    expect(splashPhaseAt(5000)).toBe('eq');
  });
});

/** Just enough of the splash node for the controller, with the equalizer at `elapsedMs`. */
function fakeSplash(elapsedMs: number) {
  const classes = new Set<string>();
  const bar = {
    style: { setProperty: vi.fn() },
    getAnimations: () => [{ animationName: 'boot-eq-1', currentTime: elapsedMs }],
  };
  return {
    bar,
    classes,
    dataset: { phase: 'intro' },
    classList: {
      add: (name: string) => classes.add(name),
      contains: (name: string) => classes.has(name),
    },
    setAttribute: vi.fn(),
    querySelector: () => bar,
    querySelectorAll: () => [bar],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  };
}

describe('boot splash controller when the app is ready during the intro', () => {
  let splash: ReturnType<typeof fakeSplash>;

  beforeEach(() => {
    splash = fakeSplash(500);
    vi.stubGlobal('document', { getElementById: () => splash });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('calms the bars at once, without touching their scale, and waits for the intro', async () => {
    let settled = false;
    void settleBootSplash().then(() => (settled = true));

    expect(splash.classes.has('calm')).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    expect(splash.bar.style.setProperty).not.toHaveBeenCalled();
  });

  it('never reports the equalizer phase once calmed', async () => {
    attachBootSplash('Loading');
    void settleBootSplash();
    await vi.advanceTimersByTimeAsync(2000);

    expect(splash.dataset.phase).toBe('intro');
  });

  it('does not start the fade before the bars have settled', async () => {
    void leaveBootSplash();

    await vi.advanceTimersByTimeAsync(999);
    expect(splash.dataset.phase).toBe('intro');
    await vi.advanceTimersByTimeAsync(1);
    expect(splash.dataset.phase).toBe('leaving');
    await vi.advanceTimersByTimeAsync(LEAVE_MS + 150);
    expect(splash.remove).toHaveBeenCalled();
  });
});

describe.each([
  ['without a document', undefined],
  ['without the splash node', { getElementById: () => null }],
])('boot splash controller %s', (_name, fakeDocument) => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resolves at once without scheduling anything', async () => {
    vi.stubGlobal('document', fakeDocument);
    vi.useFakeTimers();

    attachBootSplash('Loading');
    await settleBootSplash();
    await leaveBootSplash();

    expect(vi.getTimerCount()).toBe(0);
  });
});
