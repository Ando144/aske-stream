import { useEffect, useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { AddToPlaylistSheet } from './components/AddToPlaylistSheet';
import { Dialogs } from './components/Dialogs';
import { Sidebar, TabBar } from './components/Nav';
import { MiniPlayer, PlayerBar } from './components/player/MiniPlayer';
import { NowPlaying } from './components/player/NowPlaying';
import { Toasts } from './components/Toasts';
import { TrackMenu } from './components/TrackMenu';
import { useLibrary } from './stores/library';
import { useOffline } from './stores/offline';
import { usePlayer } from './stores/player';
import { useRadio } from './stores/radio';
import { useSetup } from './stores/setup';
import { LibraryView } from './views/LibraryView';
import { OfflineView } from './views/OfflineView';
import { PairView } from './views/PairView';
import { SetupView } from './views/SetupView';
import { FolderView } from './views/FolderView';
import { PlaylistsView } from './views/PlaylistsView';
import { PlaylistView } from './views/PlaylistView';
import { RadioView } from './views/RadioView';
import { SettingsView } from './views/SettingsView';
import { PodcastsView } from './views/PodcastsView';
import { DownloadView } from './views/DownloadView';
import { HelpView } from './views/HelpView';
import { WelcomeView } from './views/WelcomeView';
import { useTips } from './stores/tips';
import { useDownloads } from './stores/downloads';
import { useSend } from './stores/send';
import { SelectionBar } from './components/SelectionBar';
import { DriveReconnect } from './components/DriveReconnect';
import { useUi } from './stores/ui';
import { mayDoBackgroundWork } from './lib/power';

export function App() {
  const status = useSetup((s) => s.status);
  const home = useSetup((s) => s.config?.home);
  const changing = useSetup((s) => s.changing);
  const welcomeSeen = useTips((s) => s.welcomeSeen);

  useEffect(() => {
    void useSetup.getState().init();
  }, []);

  if (status === 'loading') {
    return (
      <div className="center-screen">
        <LoaderCircle className="spin" size={32} color="var(--accent)" />
      </div>
    );
  }
  if (status === 'choose' && !welcomeSeen && !changing) {
    return <WelcomeView onDone={() => useTips.getState().finishWelcome()} />;
  }
  if (status === 'choose') return <SetupView />;
  if (status === 'pair') return <PairView />;
  // Re-mount everything when the storage changes so no state leaks between libraries.
  return <Shell key={home} />;
}

const SYNC_INTERVAL_MS = 30 * 60 * 1000;

/** Keeps library and offline cache fresh: on start, on reconnect, on return to the app. */
function useBackgroundSync() {
  useEffect(() => {
    let lastFocusSync = Date.now();
    const sync = async () => {
      await useLibrary.getState().load();
      useOffline.getState().scheduleRun(2000);
    };

    void (async () => {
      await useOffline.getState().init();
      await sync();
      void useRadio.getState().load();
      // Android app: resume unfinished downloads, then pick up songs sent from the computer.
      await useDownloads.getState().init();
      void useSend.getState().checkInbox();
    })();

    const onOnline = () => {
      void sync();
      void useSend.getState().checkInbox();
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastFocusSync < 60_000) return;
      lastFocusSync = Date.now();
      void sync();
      void useSend.getState().checkInbox();
    };
    const mayRun = () =>
      mayDoBackgroundWork({
        hidden: document.visibilityState === 'hidden',
        playing: usePlayer.getState().isPlaying,
      });
    const interval = setInterval(() => {
      if (mayRun()) useOffline.getState().scheduleRun(0);
    }, SYNC_INTERVAL_MS);
    const inbox = setInterval(
      () => {
        if (mayRun()) void useSend.getState().checkInbox();
      },
      5 * 60 * 1000,
    );
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      clearInterval(inbox);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

function Shell() {
  useBackgroundSync();
  const hasPlayer = usePlayer((s) => s.mode !== 'idle');
  const [location] = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    // Leaving a screen ends multi-select (except the playlist "Add songs" picker).
    if (!useUi.getState().selectionTarget) useUi.getState().endSelection();
  }, [location]);

  return (
    <div className="app">
      <Sidebar />
      <main ref={mainRef} className={`main${hasPlayer ? '' : ' no-player'}`}>
        <DriveReconnect />
        <Switch>
          <Route path="/" component={LibraryView} />
          <Route path="/playlists" component={PlaylistsView} />
          <Route path="/folder/:id">
            {(params) => <FolderView key={params.id} id={params.id} />}
          </Route>
          <Route path="/liked">{() => <PlaylistView liked />}</Route>
          <Route path="/playlist/:id">
            {(params) => <PlaylistView key={params.id} id={params.id} />}
          </Route>
          <Route path="/podcasts" component={PodcastsView} />
          <Route path="/radio" component={RadioView} />
          <Route path="/download" component={DownloadView} />
          <Route path="/help">{() => <HelpView />}</Route>
          <Route path="/help/:id">{(params) => <HelpView key={params.id} id={params.id} />}</Route>
          <Route path="/welcome">{() => <Replay />}</Route>
          <Route path="/offline" component={OfflineView} />
          <Route path="/settings" component={SettingsView} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </main>
      <MiniPlayer />
      <PlayerBar />
      <TabBar />
      <NowPlaying />
      <TrackMenu />
      <AddToPlaylistSheet />
      <Dialogs />
      <SelectionBar />
      <Toasts />
    </div>
  );
}

/** Settings → Help → "Show the introduction again". */
function Replay() {
  const [, navigate] = useLocation();
  return <WelcomeView onDone={() => navigate('/')} />;
}
