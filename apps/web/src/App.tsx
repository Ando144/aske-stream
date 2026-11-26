import { useEffect, useRef, useState } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { parseHubHash } from '@aske/shared/hub';
import { AddToPlaylistSheet } from './components/AddToPlaylistSheet';
import { Dialogs } from './components/Dialogs';
import { Sidebar, TabBar } from './components/Nav';
import { MiniPlayer, PlayerBar } from './components/player/MiniPlayer';
import { NowPlaying } from './components/player/NowPlaying';
import { Toasts } from './components/Toasts';
import { TrackMenu } from './components/TrackMenu';
import { ShowPickSheet } from './components/podcasts/ShowPickSheet';
import { ServerUpdateBanner } from './components/ServerUpdateBanner';
import { useCloudflareSetup } from './stores/cloudflareSetup';
import { useServerUpdate } from './stores/serverUpdate';
import { CloudflareSetupView } from './views/CloudflareSetupView';
import { useLibrary } from './stores/library';
import { useOffline } from './stores/offline';
import { usePlayer } from './stores/player';
import { useRadio } from './stores/radio';
import { useSetup } from './stores/setup';
import { LibraryView } from './views/LibraryView';
import { OfflineView } from './views/OfflineView';
import { PairView } from './views/PairView';
import { RecapView } from './views/RecapView';
import { GroupsView, takePendingGroupCode } from './views/GroupsView';
import { GroupView } from './views/GroupView';
import { syncGroupStats } from './groups/sync';
import { useGroups } from './stores/groups';
import { SetupView } from './views/SetupView';
import { StudyView } from './views/StudyView';
import { useStudy } from './stores/study';
import { FolderView } from './views/FolderView';
import { PlaylistsView } from './views/PlaylistsView';
import { PlaylistView } from './views/PlaylistView';
import { RadioView } from './views/RadioView';
import { SettingsView } from './views/SettingsView';
import { PodcastsView } from './views/PodcastsView';
import { DownloadView } from './views/DownloadView';
import { HelpView } from './views/HelpView';
import { WelcomeView } from './views/WelcomeView';
import { SharedListView } from './views/SharedListView';
import { JamView, PENDING_JAM_KEY } from './views/JamView';
import { JamBanner } from './components/jam/JamBanner';
import { useJam } from './stores/jam';
import { useJamBarVisible } from './hub/jamRemote';
import { useTips } from './stores/tips';
import { useDownloads } from './stores/downloads';
import { useSend } from './stores/send';
import { SelectionBar } from './components/SelectionBar';
import { PlaylistSelectionBar } from './components/PlaylistSelectionBar';
import { ParcelSheet } from './components/send/ParcelSheet';
import { useParcel } from './stores/parcel';
import { isNative } from './native/platform';
import { DriveReconnect } from './components/DriveReconnect';
import { toast, useUi } from './stores/ui';
import { t } from './i18n';
import { mayDoBackgroundWork, mayRotateOfflineNow } from './lib/power';
import { BootSplash } from './components/BootSplash';
import { ConnectionBanner } from './components/ConnectionBanner';
import { BOOT_MAX_WAIT_MS, bootReady, splashTimings } from './lib/boot';
import { BOOT_TIMEOUT_MS, isTimeout, withTimeout } from './lib/timeout';
import {
  canUseNetwork,
  onReconnect,
  startConnectivityWatch,
  useConnectivity,
} from './stores/connectivity';

const PENDING_LINK_KEY = 'pending-hub-link';

/**
 * A shared-playlist link opens the app as `/#list=ID`. Keep the id for the session and clean the
 * address, so it survives the welcome / setup screens and a reload.
 */
function takePendingListId(): string | null {
  const link = parseHubHash(location.hash);
  if (link?.kind === 'list') {
    sessionStorage.setItem(PENDING_LINK_KEY, link.id);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return sessionStorage.getItem(PENDING_LINK_KEY);
}

/** A Jam link opens the app as `/#jam=CODE`; same idea as the shared-playlist link. */
function takePendingJamCode(): string | null {
  const link = parseHubHash(location.hash);
  if (link?.kind === 'jam') {
    sessionStorage.setItem(PENDING_JAM_KEY, link.code);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return sessionStorage.getItem(PENDING_JAM_KEY);
}

/** Starts setup and the connection watch; true once the opening screen can go away. */
function useBootReady(setupLoading: boolean, minMs: number): boolean {
  const connection = useConnectivity((s) => s.status);
  const [startedAt] = useState(() => Date.now());
  const [, forceRender] = useState(0);

  useEffect(() => {
    // init() sets the storage home synchronously, before the first probe reads it.
    void useSetup.getState().init();
    const stopWatch = startConnectivityWatch();
    void useConnectivity.getState().check();
    const timers = [minMs, BOOT_MAX_WAIT_MS].map((ms) =>
      setTimeout(() => forceRender((n) => n + 1), ms),
    );
    return () => {
      stopWatch();
      timers.forEach(clearTimeout);
    };
  }, [minMs]);

  return bootReady({ setupLoading, elapsedMs: Date.now() - startedAt, connection }, minMs);
}

/** True for exitMs after the app becomes ready, while the opening screen fades out. */
function useSplashExit(ready: boolean, exitMs: number): boolean {
  const [exitDone, setExitDone] = useState(false);
  useEffect(() => {
    if (!ready) {
      setExitDone(false);
      return;
    }
    const timer = setTimeout(() => setExitDone(true), exitMs);
    return () => clearTimeout(timer);
  }, [ready, exitMs]);
  return ready && !exitDone;
}

export function App() {
  const status = useSetup((s) => s.status);
  const [{ minMs, exitMs }] = useState(() =>
    splashTimings(window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  );
  const ready = useBootReady(status === 'loading', minMs);
  const leaving = useSplashExit(ready, exitMs);

  if (!ready) return <BootSplash />;
  return (
    <>
      <AppScreens />
      {leaving && <BootSplash leaving />}
    </>
  );
}

function AppScreens() {
  const [pendingListId] = useState(takePendingListId);
  const [pendingJamCode] = useState(takePendingJamCode);
  const [introDone, setIntroDone] = useState(false);
  const [jamIntroDone, setJamIntroDone] = useState(false);
  const status = useSetup((s) => s.status);
  const home = useSetup((s) => s.config?.home);
  const changing = useSetup((s) => s.changing);
  const welcomeSeen = useTips((s) => s.welcomeSeen);
  const setupFlowActive = useCloudflareSetup(
    (s) => s.mode === 'setup' && (s.phase === 'running' || s.phase === 'done'),
  );

  const beforeSetup = (status === 'choose' || status === 'pair') && !changing;
  if (beforeSetup && pendingJamCode && !jamIntroDone) {
    return <JamView onExit={() => setJamIntroDone(true)} />;
  }
  if (beforeSetup && pendingListId && !introDone) {
    return <SharedListView id={pendingListId} onStart={() => setIntroDone(true)} />;
  }
  if (status === 'choose' && !welcomeSeen && !changing) {
    return <WelcomeView onDone={() => useTips.getState().finishWelcome()} />;
  }
  if (status === 'choose') return <SetupView />;
  if (status === 'pair') return <PairView />;
  // connectCloudflare() marks the app "ready" before the assistant shows its "done" screen.
  if (status === 'cloudflareSetup' || setupFlowActive) return <CloudflareSetupView mode="setup" />;
  // Re-mount everything when the storage changes so no state leaks between libraries.
  return <Shell key={home} />;
}

const SYNC_INTERVAL_MS = 30 * 60 * 1000;

/** Keeps library and offline cache fresh: on start, on reconnect, on return to the app. */
function useBackgroundSync() {
  useEffect(() => {
    let lastFocusSync = Date.now();
    const sync = async () => {
      try {
        await withTimeout(useLibrary.getState().load(), BOOT_TIMEOUT_MS);
      } catch (err) {
        if (!isTimeout(err)) throw err;
        useConnectivity.getState().reportTrouble();
      }
      useOffline.getState().scheduleRun(2000);
    };
    const checkInbox = () => {
      if (canUseNetwork()) void useSend.getState().checkInbox();
    };

    void (async () => {
      await useOffline.getState().init();
      await sync();
      void useRadio.getState().load();
      // Android app: resume unfinished downloads, then pick up songs sent from the computer.
      await useDownloads.getState().init();
      checkInbox();
    })();

    const onOnline = () => {
      const downloads = useDownloads.getState();
      const hasWork = downloads.jobs.some(
        (j) =>
          j.status !== 'done' &&
          j.status !== 'error' &&
          j.status !== 'canceled' &&
          j.status !== 'skipped',
      );
      if (downloads.waitingNetwork && hasWork) toast(t('dl.resumed'));
      void downloads.resume();
      void sync();
      checkInbox();
      void useServerUpdate.getState().check();
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void useDownloads.getState().resume();
      if (Date.now() - lastFocusSync < 60_000) return;
      lastFocusSync = Date.now();
      void sync();
      checkInbox();
    };
    const mayRun = () =>
      mayDoBackgroundWork({
        hidden: document.visibilityState === 'hidden',
        playing: usePlayer.getState().isPlaying,
      });
    const interval = setInterval(() => {
      void mayRotateOfflineNow(usePlayer.getState().isPlaying).then((ok) => {
        if (ok) useOffline.getState().scheduleRun(0);
      });
    }, SYNC_INTERVAL_MS);
    const inbox = setInterval(
      () => {
        if (mayRun()) checkInbox();
      },
      5 * 60 * 1000,
    );
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const stopReconnect = onReconnect(onOnline);
    return () => {
      clearInterval(interval);
      clearInterval(inbox);
      stopReconnect();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

function Shell() {
  useBackgroundSync();
  useEffect(() => {
    const warn = (err: unknown) => console.warn('Startup check skipped', err);
    withTimeout(useServerUpdate.getState().check(), BOOT_TIMEOUT_MS).catch(warn);
    withTimeout(useJam.getState().resume(), BOOT_TIMEOUT_MS).catch(warn);
  }, []);
  const playerActive = usePlayer((s) => s.mode !== 'idle');
  const jamBarShown = useJamBarVisible();
  const hasPlayer = playerActive || jamBarShown;
  const studyPhase = useStudy((s) => s.phase);
  const [location, navigate] = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_LINK_KEY);
    if (!pending) return;
    sessionStorage.removeItem(PENDING_LINK_KEY);
    navigate(`/shared/${pending}`);
  }, [navigate]);

  // The pending Jam code stays in sessionStorage until the Jam screen has used it.
  useEffect(() => {
    if (sessionStorage.getItem(PENDING_JAM_KEY)) navigate('/jam');
  }, [navigate]);

  // A #group=CODE link opens the Groups screen with the join sheet filled in.
  useEffect(() => {
    if (takePendingGroupCode()) navigate('/groups');
  }, [navigate]);

  // Groups: finish a pending deletion of shared stats and send this month's stats.
  useEffect(() => {
    void useGroups.getState().retryPendingWipe();
    if (useGroups.getState().consent !== 'on' || !canUseNetwork()) return;
    void useGroups
      .getState()
      .refresh()
      .then(() => syncGroupStats());
  }, []);

  // A #send=CODE link: the phone app receives it; a browser can only explain what to do.
  useEffect(() => {
    const link = parseHubHash(window.location.hash);
    if (link?.kind !== 'send') return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    if (isNative) {
      useParcel.getState().setPendingCode(link.code);
      navigate('/download');
    } else {
      toast(t('parcel.openInApp'));
    }
  }, [navigate]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    // Leaving a screen ends multi-select (except the "Add songs" picker, which LibraryView has
    // already started: child effects run before this one).
    if (!useUi.getState().selectionTarget) useUi.getState().endSelection();
    useUi.getState().endPlaylistSelection();
  }, [location]);

  // Focus mode: while a session is on, nothing but the study screen is shown.
  if (studyPhase !== 'idle') {
    return (
      <div className="app study-mode">
        <StudyView />
        <Dialogs />
        <Toasts />
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <main ref={mainRef} className={`main${hasPlayer ? '' : ' no-player'}`}>
        <DriveReconnect />
        <ServerUpdateBanner />
        <ConnectionBanner />
        <JamBanner />
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
          <Route path="/shared/:id">
            {(params) => <SharedListView key={params.id} id={params.id} />}
          </Route>
          <Route path="/jam">{() => <JamView />}</Route>
          <Route path="/recap" component={RecapView} />
          <Route path="/study" component={StudyView} />
          <Route path="/groups" component={GroupsView} />
          <Route path="/groups/:id">
            {(params) => <GroupView key={params.id} id={params.id} />}
          </Route>
          <Route path="/podcasts" component={PodcastsView} />
          <Route path="/radio" component={RadioView} />
          <Route path="/download" component={DownloadView} />
          <Route path="/help">{() => <HelpView />}</Route>
          <Route path="/help/:id">{(params) => <HelpView key={params.id} id={params.id} />}</Route>
          <Route path="/welcome">{() => <Replay />}</Route>
          <Route path="/offline" component={OfflineView} />
          <Route path="/settings" component={SettingsView} />
          <Route path="/server-update">
            {() => <CloudflareSetupView mode="update" onExit={() => navigate('/settings')} />}
          </Route>
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
      <ShowPickSheet />
      <AddToPlaylistSheet />
      <Dialogs />
      <SelectionBar />
      <PlaylistSelectionBar />
      <ParcelSheet />
      <Toasts />
    </div>
  );
}

/** Settings → Help → "Show the introduction again". */
function Replay() {
  const [, navigate] = useLocation();
  return <WelcomeView onDone={() => navigate('/')} />;
}
