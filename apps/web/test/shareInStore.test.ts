import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startShareIn, useShareIn } from '../src/stores/shareIn';

const native = vi.hoisted(() => ({
  takeSharedText: vi.fn<() => Promise<string | null>>(),
  onSharedText: vi.fn<(cb: (text: string) => void) => Promise<() => void>>(),
}));

vi.mock('../src/native/shareTarget', () => native);

const VIDEO = 'https://youtu.be/abc123def45';
const PLAYLIST = 'https://youtube.com/playlist?list=PLabcdefghij';

let share: (text: string) => void;
const unsubscribe = vi.fn();
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  useShareIn.getState().clear();
  unsubscribe.mockReset();
  native.takeSharedText.mockReset().mockResolvedValue(null);
  native.onSharedText.mockReset().mockImplementation(async (cb) => {
    share = cb;
    return unsubscribe;
  });
});

describe('useShareIn', () => {
  it('receives a shared text as a parsed link', () => {
    useShareIn.getState().receive(`Look ${VIDEO}`);

    expect(useShareIn.getState().pending).toEqual({
      kind: 'video',
      videoId: 'abc123def45',
      url: VIDEO,
    });
  });

  it('replaces the previous link with the new one', () => {
    useShareIn.getState().receive(VIDEO);
    useShareIn.getState().receive(PLAYLIST);

    expect(useShareIn.getState().pending).toMatchObject({ kind: 'playlist' });
  });

  it('keeps an invalid text so the sheet can explain it', () => {
    useShareIn.getState().receive('hola');

    expect(useShareIn.getState().pending).toEqual({ kind: 'invalid' });
  });

  it('clears the pending link', () => {
    useShareIn.getState().receive(VIDEO);
    useShareIn.getState().clear();

    expect(useShareIn.getState().pending).toBeNull();
  });
});

describe('startShareIn', () => {
  it('reads the text that opened the app, once', async () => {
    native.takeSharedText.mockResolvedValue(VIDEO);

    startShareIn();
    await settle();

    expect(native.takeSharedText).toHaveBeenCalledTimes(1);
    expect(useShareIn.getState().pending).toMatchObject({ videoId: 'abc123def45' });
  });

  it('stays empty when nothing was shared', async () => {
    startShareIn();
    await settle();

    expect(useShareIn.getState().pending).toBeNull();
  });

  it('receives texts shared while the app is open', async () => {
    startShareIn();
    await settle();

    share(PLAYLIST);

    expect(useShareIn.getState().pending).toMatchObject({ kind: 'playlist' });
  });

  it('does not let the older opening text replace a newer shared one', async () => {
    let open: (text: string) => void = () => {};
    native.takeSharedText.mockReturnValue(new Promise((resolve) => (open = resolve)));
    startShareIn();
    await settle();

    share(PLAYLIST);
    open(VIDEO);
    await settle();

    expect(useShareIn.getState().pending).toMatchObject({ kind: 'playlist' });
  });

  it('keeps the opening text even if stopped before it arrives', async () => {
    native.takeSharedText.mockResolvedValue(VIDEO);

    startShareIn()();
    await settle();

    expect(useShareIn.getState().pending).toMatchObject({ kind: 'video' });
  });

  it('unsubscribes when stopped', async () => {
    const stop = startShareIn();
    await settle();

    stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes even if stopped before the subscription is ready', async () => {
    startShareIn()();
    await settle();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
