export const BOOT_TIMEOUT_MS = 4000;

export class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

/** Rejects with TimeoutError when the promise takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function isTimeout(err: unknown): boolean {
  return err instanceof TimeoutError || (err instanceof Error && err.name === 'TimeoutError');
}
