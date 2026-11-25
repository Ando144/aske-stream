import { beforeEach, describe, expect, it, vi } from 'vitest';

// The store registers online/offline listeners on import; tests run in plain Node.
vi.hoisted(() => {
  (globalThis as unknown as { window: unknown }).window = { addEventListener() {} };
});

import { useUi } from '../src/stores/ui';

beforeEach(() => {
  useUi.setState({ selection: null, selectionTarget: null, playlistSelection: null });
});

describe('playlist selection', () => {
  it('starts empty or with the first playlist', () => {
    useUi.getState().startPlaylistSelection();
    expect(useUi.getState().playlistSelection).toEqual([]);
    useUi.getState().startPlaylistSelection('a');
    expect(useUi.getState().playlistSelection).toEqual(['a']);
  });

  it('toggles playlists on and off', () => {
    const ui = useUi.getState();
    ui.startPlaylistSelection('a');
    ui.togglePlaylistSelected('b');
    expect(useUi.getState().playlistSelection).toEqual(['a', 'b']);
    ui.togglePlaylistSelected('a');
    expect(useUi.getState().playlistSelection).toEqual(['b']);
  });

  it('selectAll selects every id and empties when all were selected', () => {
    const ui = useUi.getState();
    ui.startPlaylistSelection('a');
    ui.selectAllPlaylists(['a', 'b', 'c']);
    expect(useUi.getState().playlistSelection).toEqual(['a', 'b', 'c']);
    ui.selectAllPlaylists(['a', 'b', 'c']);
    expect(useUi.getState().playlistSelection).toEqual([]);
  });

  it('publishes the selectable ids of the current screen, replacing the previous ones', () => {
    const ui = useUi.getState();
    ui.setPlaylistVisibleIds(['loose1', 'loose2']);
    expect(useUi.getState().playlistVisibleIds).toEqual(['loose1', 'loose2']);
    ui.setPlaylistVisibleIds(['inside1']);
    ui.startPlaylistSelection();
    ui.selectAllPlaylists(useUi.getState().playlistVisibleIds);
    expect(useUi.getState().playlistSelection).toEqual(['inside1']);
  });

  it('ends the selection', () => {
    useUi.getState().startPlaylistSelection('a');
    useUi.getState().endPlaylistSelection();
    expect(useUi.getState().playlistSelection).toBeNull();
  });
});

describe('song and playlist selection exclude each other', () => {
  it('starting playlist selection closes the song one', () => {
    useUi.getState().startSelection('t1');
    useUi.getState().startPlaylistSelection('p1');
    expect(useUi.getState().selection).toBeNull();
    expect(useUi.getState().playlistSelection).toEqual(['p1']);
  });

  it('starting song selection closes the playlist one', () => {
    useUi.getState().startPlaylistSelection('p1');
    useUi.getState().startSelection('t1');
    expect(useUi.getState().playlistSelection).toBeNull();
    expect(useUi.getState().selection).toEqual(['t1']);
  });
});
