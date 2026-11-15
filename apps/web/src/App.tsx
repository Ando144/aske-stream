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
import { useSession } from './stores/session';
import { LibraryView } from './views/LibraryView';
import { OfflineView } from './views/OfflineView';
import { PairView } from './views/PairView';
import { PlaylistsView } from './views/PlaylistsView';
import { PlaylistView } from './views/PlaylistView';
import { RadioView } from './views/RadioView';
import { SettingsView } from './views/SettingsView';

export function App() {
  const status = useSession((s) => s.status);

  useEffect(() => {
    void useSession.getState().check();
  }, []);

  if (status === 'checking') {
    return (
      <div className="center-screen">
        <LoaderCircle className="spin" size={32} color="var(--accent)" />
      </div>
    );
  }
  if (status === 'unpaired') return <PairView />;
  return <Shell />;
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
    })();

    const onOnline = () => void sync();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastFocusSync < 60_000) return;
      lastFocusSync = Date.now();
      void sync();
    };
    const interval = setInterval(() => useOffline.getState().scheduleRun(0), SYNC_INTERVAL_MS);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
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
  }, [location]);

  return (
    <div className="app">
      <Sidebar />
      <main ref={mainRef} className={`main${hasPlayer ? '' : ' no-player'}`}>
        <Switch>
          <Route path="/" component={LibraryView} />
          <Route path="/playlists" component={PlaylistsView} />
          <Route path="/liked">{() => <PlaylistView liked />}</Route>
          <Route path="/playlist/:id">
            {(params) => <PlaylistView key={params.id} id={params.id} />}
          </Route>
          <Route path="/radio" component={RadioView} />
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
      <Toasts />
    </div>
  );
}
