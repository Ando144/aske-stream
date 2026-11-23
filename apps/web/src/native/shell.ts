import { App as CapApp } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useSetup } from '../stores/setup';
import { useStudy } from '../stores/study';
import { useUi } from '../stores/ui';
import { isNative } from './platform';

/**
 * Android-only glue: the phone's Back button and the colour of the status
 * and navigation bar icons. Does nothing in a browser.
 */
export function initNativeShell() {
  if (!isNative) return;

  // Status-bar icons follow the app theme (light icons on the dark theme).
  const syncBars = () => {
    const dark = document.documentElement.dataset.theme !== 'light';
    void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(
      () => undefined,
    );
  };
  syncBars();
  new MutationObserver(syncBars).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // Back button: close whatever is on top first, like any Android app.
  void CapApp.addListener('backButton', () => {
    // Study mode keeps the screen pinned: Back does nothing until it ends.
    if (useStudy.getState().phase !== 'idle') return;
    const ui = useUi.getState();
    if (ui.confirm) return ui.confirm.resolve(false);
    if (ui.prompt) return ui.prompt.resolve(null);
    if (ui.trackMenu) return ui.closeTrackMenu();
    if (ui.playlistSheet) return ui.closePlaylistSheet();
    if (ui.nowPlayingOpen) return ui.setNowPlayingOpen(false);
    if (ui.selection) return ui.endSelection();

    const setup = useSetup.getState();
    if (setup.status === 'pair') return setup.backToChoice();
    if (setup.status === 'choose' && setup.changing) return setup.cancelChange();

    if (setup.status === 'ready' && location.pathname !== '/') return history.back();
    // On the home screen: go to the background (music keeps playing) instead of closing.
    void CapApp.minimizeApp();
  });
}
