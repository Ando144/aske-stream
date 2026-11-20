import { describe, expect, it, vi } from 'vitest';
import { createRunThrottle } from '../src/offline/runThrottle';

const GAP = 10 * 60 * 1000;

function setup(mayRun: () => Promise<boolean>) {
  let time = 1_000_000;
  const run = vi.fn();
  const mayRunSpy = vi.fn(mayRun);
  const trigger = createRunThrottle({
    minGapMs: GAP,
    mayRun: mayRunSpy,
    run,
    now: () => time,
  });
  return { trigger, run, mayRunSpy, advance: (ms: number) => (time += ms) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createRunThrottle', () => {
  it('runs on the first call', async () => {
    const { trigger, run } = setup(async () => true);
    trigger();
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('ignores a second call before the gap and runs again after it', async () => {
    const { trigger, run, advance } = setup(async () => true);
    trigger();
    await flush();
    advance(GAP - 1);
    trigger();
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    advance(1);
    trigger();
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not run when mayRun is false and checks again next time', async () => {
    const { trigger, run, mayRunSpy } = setup(async () => false);
    trigger();
    await flush();
    trigger();
    await flush();
    expect(run).not.toHaveBeenCalled();
    expect(mayRunSpy).toHaveBeenCalledTimes(2);
  });

  it('checks only once while a check is pending', async () => {
    let resolve!: (v: boolean) => void;
    const { trigger, run, mayRunSpy } = setup(() => new Promise((r) => (resolve = r)));
    trigger();
    trigger();
    expect(mayRunSpy).toHaveBeenCalledTimes(1);
    resolve(true);
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('survives a rejecting mayRun without running', async () => {
    const { trigger, run, mayRunSpy } = setup(() => Promise.reject(new Error('boom')));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    trigger();
    await flush();
    trigger();
    await flush();
    process.off('unhandledRejection', unhandled);
    expect(run).not.toHaveBeenCalled();
    expect(mayRunSpy).toHaveBeenCalledTimes(2);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
