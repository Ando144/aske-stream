package io.github.ando144.askestream;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * YouTube downloads on the phone, with yt-dlp (Python + QuickJS bundled by
 * youtubedl-android). yt-dlp itself can be updated from inside the app, so a
 * YouTube change does not require a new app version.
 *
 * Files are written to the app's private cache; the web side then moves them
 * to the library (on the phone or to Cloudflare) and calls deleteFile.
 */
@CapacitorPlugin(
    name = "Downloader",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class DownloaderPlugin extends Plugin {

    private static final String DIR = "downloads";
    private final ExecutorService lookups = Executors.newFixedThreadPool(2);

    private File workDir() {
        File dir = new File(getContext().getCacheDir(), DIR);
        if (!dir.isDirectory()) dir.mkdirs();
        return dir;
    }

    private void ensureReady() throws Exception {
        DownloadWorker.ensureReady(getContext());
    }

    private String engineVersion() {
        String v = YoutubeDL.getInstance().versionName(getContext());
        return v == null ? YoutubeDL.getInstance().version(getContext()) : v;
    }

    /** Prepares Python/yt-dlp (the first time it unpacks ~40 MB, a few seconds). */
    @PluginMethod
    public void init(PluginCall call) {
        lookups.execute(() -> {
            try {
                ensureReady();
                JSObject ret = new JSObject();
                ret.put("version", engineVersion());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("The downloader could not start: " + e.getMessage(), "init_failed", e);
            }
        });
    }

    /** Downloads the latest stable yt-dlp from its official GitHub releases. */
    @PluginMethod
    public void updateEngine(PluginCall call) {
        // Same thread as the downloads, so an update never runs while a song downloads.
        DownloadWorker.EXEC.execute(() -> {
            try {
                ensureReady();
                YoutubeDL.UpdateStatus status = YoutubeDL.getInstance()
                    .updateYoutubeDL(getContext().getApplicationContext(), YoutubeDL.UpdateChannel._STABLE);
                JSObject ret = new JSObject();
                ret.put("updated", status == YoutubeDL.UpdateStatus.DONE);
                ret.put("version", engineVersion());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not update the downloader: " + e.getMessage(), "update_failed", e);
            }
        });
    }

    /**
     * Lists a playlist or runs a search ("ytsearch20:…") without downloading.
     * Returns a small JSON: {title, uploader, entries:[{id,title,uploader,duration}]}.
     */
    @PluginMethod
    public void list(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        lookups.execute(() -> {
            try {
                ensureReady();
                YoutubeDLRequest req = new YoutubeDLRequest(url);
                req.addOption("--flat-playlist");
                req.addOption("--dump-single-json");
                req.addOption("--no-warnings");
                YoutubeDLResponse res = YoutubeDL.getInstance().execute(req, null, null);
                JSONObject json = new JSONObject(res.getOut());
                JSObject ret = new JSObject();
                ret.put("title", json.optString("title", ""));
                ret.put("uploader", json.optString("uploader", json.optString("channel", "")));
                JSONArray entries = json.optJSONArray("entries");
                JSONArray out = new JSONArray();
                if (entries != null) {
                    for (int i = 0; i < entries.length(); i++) {
                        JSONObject e = entries.optJSONObject(i);
                        if (e == null || e.optString("id").isEmpty()) continue;
                        JSONObject o = new JSONObject();
                        o.put("id", e.optString("id"));
                        o.put("title", e.optString("title", ""));
                        o.put("uploader", e.optString("uploader", e.optString("channel", "")));
                        o.put("duration", e.optDouble("duration", 0));
                        out.put(o);
                    }
                }
                ret.put("entries", out);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(DownloadWorker.shortError(e), "list_failed", e);
            }
        });
    }

    /**
     * Adds songs to the phone's own queue and starts the service. The queue keeps going (and is
     * saved to disk) when the app is closed. `texts` are the notification texts for that case.
     */
    @PluginMethod
    public void queue(PluginCall call) {
        JSONArray jobs = call.getArray("jobs");
        JSObject texts = call.getObject("texts");
        if (jobs == null) {
            call.reject("jobs are required");
            return;
        }
        List<DownloadQueue.Job> parsed = new ArrayList<>();
        for (int i = 0; i < jobs.length(); i++) {
            JSONObject j = jobs.optJSONObject(i);
            String jobId = j == null ? "" : j.optString("jobId");
            String videoId = j == null ? "" : j.optString("videoId");
            if (jobId.isEmpty() || !videoId.matches("[\\w-]{6,20}")) {
                call.reject("jobId and a valid videoId are required");
                return;
            }
            parsed.add(new DownloadQueue.Job(jobId, videoId, 0));
        }
        DownloadQueue.get(getContext()).add(parsed, texts);
        startService(null);
        call.resolve();
    }

    /** What is queued, running and finished (including what finished while the app was closed). */
    @PluginMethod
    public void pending(PluginCall call) {
        DownloadService.clearDoneNotice(getContext());
        JSObject ret = DownloadQueue.get(getContext()).snapshot();
        ret.put("waitingNetwork", DownloadService.waitingNetwork);
        call.resolve(ret);
    }

    /** The app has taken a finished song: forget it and delete its files. */
    @PluginMethod
    public void ack(PluginCall call) {
        String jobId = call.getString("jobId", "");
        DownloadQueue.get(getContext()).ack(jobId);
        call.resolve();
    }

    private final DownloadService.Listener serviceListener = new DownloadService.Listener() {
        @Override
        public void onProgress(String jobId, float progress, long eta) {
            JSObject p = new JSObject();
            p.put("jobId", jobId);
            p.put("progress", progress);
            p.put("eta", eta);
            notifyListeners("progress", p);
        }

        @Override
        public void onFinished(JSObject result) {
            notifyListeners("finished", result);
        }

        @Override
        public void onNetwork(boolean waiting) {
            JSObject p = new JSObject();
            p.put("waiting", waiting);
            notifyListeners("network", p);
        }
    };

    @Override
    public void load() {
        DownloadService.listener = serviceListener;
    }

    /** Removes a song that has not started, or stops the one downloading. */
    @PluginMethod
    public void cancel(PluginCall call) {
        String jobId = call.getString("jobId", "");
        DownloadQueue q = DownloadQueue.get(getContext());
        boolean canceled = q.remove(jobId);
        if (!canceled && q.isCurrent(jobId)) canceled = YoutubeDL.getInstance().destroyProcessById(jobId);
        JSObject ret = new JSObject();
        ret.put("canceled", canceled);
        call.resolve(ret);
    }

    /** Saves a picture (video thumbnail) next to the download. https only. */
    @PluginMethod
    public void fetchImage(PluginCall call) {
        String url = call.getString("url");
        String jobId = call.getString("jobId", "img").replaceAll("[^\\w-]", "");
        if (url == null || !url.startsWith("https://")) {
            call.reject("https url required");
            return;
        }
        lookups.execute(() -> {
            HttpURLConnection c = null;
            try {
                File dir = new File(workDir(), jobId);
                dir.mkdirs();
                File out = new File(dir, "cover.img");
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(15_000);
                c.setReadTimeout(30_000);
                if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
                long max = 8L * 1024 * 1024;
                long total = 0;
                try (InputStream in = c.getInputStream(); OutputStream o = new FileOutputStream(out)) {
                    byte[] buf = new byte[32 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        total += n;
                        if (total > max) throw new Exception("Image too big");
                        o.write(buf, 0, n);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("path", out.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(DownloadWorker.shortError(e), "image_failed", e);
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    /** Removes a finished job's files (only inside the app's download folders). */
    @PluginMethod
    public void deleteFile(PluginCall call) {
        File f = new File(call.getString("path", ""));
        try {
            File[] roots = { workDir(), DownloadWorker.rootDir(getContext()) };
            for (File root : roots) {
                String rootPath = root.getCanonicalPath();
                if (!f.getCanonicalPath().startsWith(rootPath + File.separator)) continue;
                File parent = f.getParentFile();
                DownloadWorker.deleteRecursive(f);
                if (parent != null && !parent.getCanonicalPath().equals(rootPath)) {
                    String[] left = parent.list();
                    if (left == null || left.length == 0) parent.delete();
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not delete", e);
        }
    }

    /** Clears the old cache folder of downloads (never the queue's own folder). */
    @PluginMethod
    public void clearAll(PluginCall call) {
        lookups.execute(() -> {
            DownloadWorker.deleteRecursive(workDir());
            call.resolve();
        });
    }

    /* ------------------------- progress notification ------------------------- */

    /**
     * While downloading, keep the WebView renderer at important priority even when hidden: Android
     * demotes (and may freeze or kill) the renderer of a hidden WebView that is not playing audio,
     * which would stop the JS download queue. Back to the default when the queue is idle.
     */
    private void setRendererPriority(boolean downloading) {
        if (Build.VERSION.SDK_INT < 26 || getBridge() == null) return;
        getBridge().executeOnMainThread(() -> {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, !downloading);
            }
        });
    }

    /** Shows/updates (active=true) or hands the notification back to the phone (active=false). */
    @PluginMethod
    public void setNotification(PluginCall call) {
        Context ctx = getContext();
        boolean active = Boolean.TRUE.equals(call.getBoolean("active", false));
        setRendererPriority(active);
        DownloadService.jsKeepAlive = active;
        if (!active) {
            // The service stops by itself when the phone's queue is empty.
            DownloadService.appStateChanged();
            call.resolve();
            return;
        }
        String title = call.getString("title", "");
        String text = call.getString("text", "");
        int progress = call.getInt("progress", -1);
        if (DownloadService.running) {
            // Already in the foreground: just refresh the notification (works with the app in the background).
            DownloadService.update(ctx, title, text, progress);
            call.resolve();
            return;
        }
        startService(new Object[] { title, text, progress });
        call.resolve();
    }

    /** Starts the foreground service; extras = {title, text, progress} when the app writes the notification. */
    private void startService(Object[] extras) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, DownloadService.class);
        if (extras != null) {
            intent.putExtra("title", (String) extras[0]);
            intent.putExtra("text", (String) extras[1]);
            intent.putExtra("progress", (Integer) extras[2]);
        }
        try {
            ContextCompat.startForegroundService(ctx, intent);
        } catch (Exception e) {
            // Android refuses to start it from the background; the queue is saved and runs on the next start.
            Log.w("DownloaderPlugin", "Could not start the download service: " + e);
        }
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsResult");
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        // Downloads go on without the app: only forget this (dead) listener and tell the service.
        if (DownloadService.listener == serviceListener) DownloadService.listener = null;
        DownloadService.jsKeepAlive = false;
        DownloadService.appStateChanged();
        lookups.shutdownNow();
    }
}
