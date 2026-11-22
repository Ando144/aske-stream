package io.github.ando144.askestream;

import android.app.Notification;
import android.app.NotificationManager;
import android.os.Handler;
import android.os.SystemClock;

/**
 * The only writer of the download notification. Android silently drops the updates of an app that
 * posts more than ~5 per second, so progress is published at most once a second and phase changes
 * (new song, saving, waiting) at most every 250 ms. The latest submitted notification always wins.
 * Everything runs on the main thread.
 */
final class NotificationThrottle {

    private static final long PROGRESS_GAP_MS = 1000;
    private static final long PHASE_GAP_MS = 250;
    private static final long NONE = -1;

    private final Handler main;
    private final NotificationManager nm;
    private final int id;
    private final Runnable flushTask = this::publishPending;
    private Notification pending;
    private long lastPublishedAt = -PROGRESS_GAP_MS;
    private long scheduledFor = NONE;

    NotificationThrottle(Handler main, NotificationManager nm, int id) {
        this.main = main;
        this.nm = nm;
        this.id = id;
    }

    void submit(Notification n, boolean phaseChange) {
        pending = n;
        long now = SystemClock.uptimeMillis();
        long due = lastPublishedAt + (phaseChange ? PHASE_GAP_MS : PROGRESS_GAP_MS);
        if (now >= due) {
            publishPending();
            return;
        }
        // Keep an earlier flush that is already scheduled; only move it forward in time.
        if (scheduledFor != NONE && scheduledFor <= due) return;
        main.removeCallbacks(flushTask);
        scheduledFor = due;
        main.postDelayed(flushTask, due - now);
    }

    void cancelPending() {
        main.removeCallbacks(flushTask);
        scheduledFor = NONE;
        pending = null;
    }

    private void publishPending() {
        main.removeCallbacks(flushTask);
        scheduledFor = NONE;
        if (pending == null) return;
        Notification n = pending;
        pending = null;
        lastPublishedAt = SystemClock.uptimeMillis();
        nm.notify(id, n);
    }
}
