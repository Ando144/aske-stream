import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firstStepsView } from '../src/lib/firstSteps';
import { useTips } from '../src/stores/tips';

const base = {
  hidden: false,
  completed: false,
  libraryLoaded: true,
  radioLoaded: true,
  steps: [true, false],
};

describe('firstStepsView', () => {
  it('waits while radio is not loaded, even with missing steps', () => {
    expect(firstStepsView({ ...base, radioLoaded: false })).toBe('wait');
  });

  it('waits while the library is not loaded', () => {
    expect(firstStepsView({ ...base, libraryLoaded: false })).toBe('wait');
  });

  it('returns complete when every step is done', () => {
    expect(firstStepsView({ ...base, steps: [true, true] })).toBe('complete');
  });

  it('returns none when already completed, even before data loads', () => {
    expect(
      firstStepsView({ ...base, completed: true, libraryLoaded: false, radioLoaded: false }),
    ).toBe('none');
  });

  it('returns none when hidden', () => {
    expect(firstStepsView({ ...base, hidden: true })).toBe('none');
  });

  it('shows with loaded data and missing steps', () => {
    expect(firstStepsView(base)).toBe('show');
  });
});

describe('tips store firstStepsDone', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    });
    useTips.getState().resetAll();
  });

  it('persists markFirstStepsDone and resetAll clears it', () => {
    useTips.getState().markFirstStepsDone();
    expect(useTips.getState().firstStepsDone).toBe(true);
    expect(localStorage.getItem('aske:tips-v1')).toContain('"firstStepsDone":true');
    useTips.getState().resetAll();
    expect(useTips.getState().firstStepsDone).toBe(false);
  });
});
