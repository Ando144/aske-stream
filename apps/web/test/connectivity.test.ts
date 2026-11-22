import { describe, expect, it, vi } from 'vitest';
import {
  createConnectivityStore,
  nextRetryDelay,
  onReconnect,
  RETRY_DELAYS_MS,
} from '../src/stores/connectivity';

function setup(results: boolean[]) {
  const probe = vi.fn(async () => results.shift() ?? true);
  const cancel = vi.fn();
  const schedule = vi.fn((_fn: () => void, _ms: number) => cancel);
  const store = createConnectivityStore({ probe, schedule });
  return { store, probe, schedule, cancel };
}

describe('nextRetryDelay', () => {
  it('grows and repeats the last delay', () => {
    expect(nextRetryDelay(0)).toBe(5000);
    expect(nextRetryDelay(1)).toBe(10000);
    expect(nextRetryDelay(99)).toBe(RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
  });
});

describe('connectivity store', () => {
  it('starts checking', () => {
    expect(setup([]).store.getState().status).toBe('checking');
  });

  it('goes offline on failure and schedules growing retries', async () => {
    const { store, schedule } = setup([false, false]);
    await store.getState().check();
    expect(store.getState().status).toBe('offline');
    expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), 5000);
    await store.getState().check();
    expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), 10000);
  });

  it('runs the scheduled retry and notifies reconnection once', async () => {
    const { store, schedule } = setup([false, true]);
    const listener = vi.fn();
    const off = onReconnect(listener);
    await store.getState().check();
    schedule.mock.calls[0]![0]();
    await vi.waitFor(() => expect(store.getState().status).toBe('online'));
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('does not notify reconnection on the first success', async () => {
    const { store } = setup([true]);
    const listener = vi.fn();
    const off = onReconnect(listener);
    await store.getState().check();
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it('shares one probe between re-entrant calls', async () => {
    const { store, probe } = setup([true]);
    await Promise.all([store.getState().check(), store.getState().check()]);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('reportTrouble probes only when online', async () => {
    const { store, probe } = setup([true, false]);
    store.getState().reportTrouble();
    expect(probe).not.toHaveBeenCalled();
    await store.getState().check();
    store.getState().reportTrouble();
    await vi.waitFor(() => expect(store.getState().status).toBe('offline'));
    expect(probe).toHaveBeenCalledTimes(2);
  });
});
