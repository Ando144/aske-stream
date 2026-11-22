package io.github.ando144.askestream;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.yausername.youtubedl_android.YoutubeDL;

/**
 * Runs the phone's own download queue, so downloads go on when you leave or close the app:
 *  - a foreground service (Android does not stop the app) that restarts itself if killed,
 *  - a partial wake lock and a Wi-Fi lock, held only while downloading or waiting to retry,
 *  - the progress notification (written by the web side while the app is open, by this
 *    service from saved texts when it is closed).
 * Without internet it waits (without counting attempts); a network failure is retried later.
 */
public class DownloadService extends Service {

    /** Receives events while the app is open. */
    interface Listener {
        void onProgress(String jobId, float progress, long eta);

        void onFinished(JSObject result);

        void onNetwork(boolean waiting);
    }

    private static final String CHANNEL = "downloads";
    private static final int ID = 4242;
    private static final int DONE_ID = 4243;
    /** Safety net: never hold the processor awake for more than 3 hours at a time. */
    private static final long MAX_AWAKE_MS = 3L * 60 * 60 * 1000;
    static final long[] RETRY_DELAYS_MS = { 15_000, 30_000, 60_000, 120_000, 300_000, 600_000 };
    static final int MAX_ATTEMPTS = 6;
    /** If the app sends nothing for this long while downloading, the service writes the notification. */
    private static final long JS_SILENT_MS = 10_000;

    static volatile boolean running = false;
    /** The open app, or null when it is closed. */
    static volatile Listener listener;
    /** The app asked to keep the service alive and writes the notification itself. */
    static volatile boolean jsKeepAlive = false;
    static volatile boolean waitingNetwork = false;
    private static volatile DownloadService instance;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable pumpTask = this::pump;
    private DownloadQueue queue;
    private NetworkWatcher watcher;
    private boolean busy = false;
    private String currentJobId;
    private boolean stopping = false;
    private long notBefore = 0;
    private volatile int lastPct = 0;
    private int done = 0;
    private NotificationThrottle throttle;
    private DownloadQueue.Job currentJob;
    private String lastJsTitle = "";
    private String lastJsText = "";
    private long lastJsUpdateAt = 0;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    private static void ensureChannel(Context ctx) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, ctx.getString(R.string.downloads_channel), NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }

    static Notification build(Context ctx, String title, String text, int progress) {
        ensureChannel(ctx);
        return new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_download)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openAppIntent(ctx))
            .setProgress(100, Math.max(progress, 0), progress < 0)
            .build();
    }

    private static PendingIntent openAppIntent(Context ctx) {
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Hands the app's notification to the running service, which publishes it through the throttle. */
    static void update(Context ctx, String title, String text, int progress) {
        DownloadService s = instance;
        if (s == null) return;
        s.main.post(() -> s.submitFromJs(title, text, progress));
    }

    private void submitFromJs(String title, String text, int progress) {
        boolean phaseChange = !title.equals(lastJsTitle) || !text.equals(lastJsText);
        lastJsTitle = title;
        lastJsText = text;
        lastJsUpdateAt = SystemClock.uptimeMillis();
        throttle.submit(build(this, title, text, progress), phaseChange);
    }

    /** Removes the final notice (also when the app is open again and handles the results). */
    static void clearDone(Context ctx) {
        ctx.getSystemService(NotificationManager.class).cancel(DONE_ID);
    }

    /** Shows the final "downloads finished" notice (always, whether the app is open or not). */
    static void showDone(Context ctx, String text) {
        showNotice(ctx, text);
    }

    /** The app closed or stopped keeping the service: from now on the service writes the notification. */
    static void appStateChanged() {
        DownloadService s = instance;
        if (s == null) return;
        s.main.post(() -> {
            s.refreshNotification(true);
            s.pump();
        });
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        throttle = new NotificationThrottle(main, getSystemService(NotificationManager.class), ID);
        queue = DownloadQueue.get(this);
        watcher = new NetworkWatcher(this, () -> main.post(this::pump));
        watcher.start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // intent == null: Android restarted the service after killing it; the queue is read from disk.
        boolean fromJs = intent != null && intent.hasExtra("title");
        Notification n = fromJs
            ? build(this, intent.getStringExtra("title"), intent.getStringExtra("text"), intent.getIntExtra("progress", -1))
            : nativeNotification(0);
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(ID, n);
        }
        if (fromJs) lastJsUpdateAt = SystemClock.uptimeMillis();
        running = true;
        main.post(this::pump);
        return START_STICKY;
    }

    /* ---------------------------------- queue ---------------------------------- */

    /** Starts the next download, waits for internet or a retry time, or finishes when nothing is left. */
    private void pump() {
        if (busy || stopping) return;
        if (!queue.hasWork()) {
            onQueueEmpty();
            return;
        }
        long wait = notBefore - System.currentTimeMillis();
        if (wait > 0) {
            main.removeCallbacks(pumpTask);
            main.postDelayed(pumpTask, wait);
            return;
        }
        if (!watcher.hasValidatedInternet()) {
            setWaiting(true);
            releaseLocks();
            return;
        }
        setWaiting(false);
        startNext();
    }

    private void startNext() {
        DownloadQueue.Job job = queue.takeNext();
        if (job == null) return;
        busy = true;
        currentJobId = job.jobId;
        currentJob = job;
        lastPct = 0;
        acquireLocks();
        refreshNotification(true);
        DownloadWorker.EXEC.execute(() -> {
            JSObject result = DownloadWorker.run(this, job, this::onProgress);
            main.post(() -> onResult(job, result));
        });
    }

    private void onProgress(String jobId, float progress, long eta) {
        Listener l = listener;
        if (l != null) l.onProgress(jobId, progress, eta);
        int pct = Math.round(progress);
        if (pct != lastPct) {
            lastPct = pct;
            refreshNotification(false);
        }
    }

    private void onResult(DownloadQueue.Job job, JSObject result) {
        busy = false;
        currentJobId = null;
        currentJob = null;
        if (stopping) return; // onTimeout already requeued the job
        boolean networkFailure = !result.optBoolean("ok") && "network".equals(result.optString("code"));
        if (networkFailure && retryLater(job)) {
            pump();
            return;
        }
        queue.finish(result);
        done++;
        Listener l = listener;
        if (l != null) l.onFinished(result);
        refreshNotification(true);
        pump();
    }

    /** Puts the job back for another try. Returns false when the attempts are used up. */
    private boolean retryLater(DownloadQueue.Job job) {
        if (!watcher.hasValidatedInternet()) {
            queue.requeueCurrent(false); // no connection: waiting does not count as an attempt
            return true;
        }
        if (job.attempts >= MAX_ATTEMPTS) return false;
        notBefore = System.currentTimeMillis() + RETRY_DELAYS_MS[job.attempts];
        queue.requeueCurrent(true);
        return true;
    }

    private void onQueueEmpty() {
        done = 0;
        setWaiting(false);
        releaseLocks();
        if (jsKeepAlive) return;
        throttle.cancelPending();
        stopForeground(true);
        if (listener == null && queue.resultCount() > 0) showOpenToSave(queue.resultCount());
        stopSelf();
    }

    private void setWaiting(boolean waiting) {
        if (waitingNetwork == waiting) return;
        waitingNetwork = waiting;
        Listener l = listener;
        if (l != null) l.onNetwork(waiting);
        refreshNotification(true);
    }

    /* ------------------------------ notifications ------------------------------ */

    /** Without the app open, the phone writes the notification itself from the saved texts. */
    private Notification nativeNotification(int pct) {
        JSObject texts = queue.texts();
        int total = Math.max(done + queue.pendingCount(), 1);
        String title = texts.optString("progress")
            .replace("{done}", String.valueOf(Math.min(done + 1, total)))
            .replace("{total}", String.valueOf(total));
        if (title.isEmpty()) title = getString(R.string.app_name);
        int shown = waitingNetwork ? 0 : Math.max(pct, 0);
        int overall = Math.min(100, (done * 100 + shown) / total);
        return build(this, title, currentText(texts), overall);
    }

    private String currentText(JSObject texts) {
        if (waitingNetwork) return texts.optString("waiting");
        DownloadQueue.Job job = currentJob;
        return job == null || job.title.isEmpty() ? getString(R.string.app_name) : job.title;
    }

    /**
     * Publishes the phone's own notification when the app is not writing it: the app is closed, or
     * it has been silent for 10 s while a download runs (frozen WebView). Goes through the throttle.
     */
    private void refreshNotification(boolean phaseChange) {
        boolean jsSilent = busy && SystemClock.uptimeMillis() - lastJsUpdateAt > JS_SILENT_MS;
        if (jsKeepAlive && !jsSilent) return;
        throttle.submit(nativeNotification(Math.max(lastPct, 0)), phaseChange);
    }

    private void showOpenToSave(int count) {
        JSObject texts = queue.texts();
        showNotice(this, count == 1
            ? texts.optString("openToSaveOne")
            : texts.optString("openToSave").replace("{count}", String.valueOf(count)));
    }

    private void showPaused() {
        String text = queue.texts().optString("paused");
        showNotice(this, text.isEmpty() ? getString(R.string.downloads_paused) : text);
    }

    private static void showNotice(Context ctx, String text) {
        ensureChannel(ctx);
        Notification n = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_download)
            .setContentTitle(ctx.getString(R.string.app_name))
            .setContentText(text)
            .setAutoCancel(true)
            .setSilent(true)
            .setContentIntent(openAppIntent(ctx))
            .build();
        ctx.getSystemService(NotificationManager.class).notify(DONE_ID, n);
    }

    /* ----------------------------------- locks ---------------------------------- */

    private void acquireLocks() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AskeStream:downloads");
            wakeLock.setReferenceCounted(false);
        }
        if (!wakeLock.isHeld()) wakeLock.acquire(MAX_AWAKE_MS);
        if (wifiLock == null) {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            int mode = Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
            wifiLock = wm.createWifiLock(mode, "AskeStream:downloads");
            wifiLock.setReferenceCounted(false);
        }
        if (!wifiLock.isHeld()) wifiLock.acquire();
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    }

    @Override
    public void onDestroy() {
        running = false;
        waitingNetwork = false;
        instance = null;
        if (throttle != null) throttle.cancelPending();
        main.removeCallbacksAndMessages(null);
        if (watcher != null) watcher.stop();
        releaseLocks();
        super.onDestroy();
    }

    /**
     * Android 15 limits background data sync to 6 h a day; stop cleanly instead of crashing.
     * The running download goes back to the front of the queue without counting an attempt.
     */
    @Override
    public void onTimeout(int startId, int fgsType) {
        stopping = true;
        main.removeCallbacks(pumpTask);
        if (busy) {
            queue.requeueCurrent(false);
            cancelCurrentProcess();
        }
        releaseLocks();
        throttle.cancelPending();
        stopForeground(true);
        showPaused();
        stopSelf();
    }

    private void cancelCurrentProcess() {
        if (currentJobId == null) return;
        try {
            YoutubeDL.getInstance().destroyProcessById(currentJobId);
        } catch (RuntimeException e) {
            Log.w("DownloadService", "Could not stop the download on timeout", e);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
