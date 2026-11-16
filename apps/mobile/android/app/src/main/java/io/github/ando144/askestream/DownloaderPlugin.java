package io.github.ando144.askestream;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import kotlin.Unit;
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
    /** One download at a time; searches and playlist reads never wait for it. */
    private final ExecutorService downloads = Executors.newSingleThreadExecutor();
    private final ExecutorService lookups = Executors.newFixedThreadPool(2);
    private volatile boolean ready = false;

    private File workDir() {
        File dir = new File(getContext().getCacheDir(), DIR);
        if (!dir.isDirectory()) dir.mkdirs();
        return dir;
    }

    private void ensureReady() throws Exception {
        if (ready) return;
        synchronized (this) {
            if (!ready) {
                YoutubeDL.getInstance().init(getContext().getApplicationContext());
                ready = true;
            }
        }
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
        downloads.execute(() -> {
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
                call.reject(shortError(e), "list_failed", e);
            }
        });
    }

    /**
     * Downloads the audio of one video (Opus in WebM, kept as-is) plus a
     * summary of its metadata. Emits "progress" events.
     */
    @PluginMethod
    public void download(PluginCall call) {
        String jobId = call.getString("jobId");
        String videoId = call.getString("videoId");
        if (jobId == null || videoId == null || !videoId.matches("[\\w-]{6,20}")) {
            call.reject("jobId and a valid videoId are required");
            return;
        }
        downloads.execute(() -> {
            File dir = new File(workDir(), jobId.replaceAll("[^\\w-]", ""));
            try {
                ensureReady();
                deleteRecursive(dir);
                dir.mkdirs();
                YoutubeDLRequest req = new YoutubeDLRequest("https://www.youtube.com/watch?v=" + videoId);
                req.addOption("-f", "bestaudio[ext=webm]/bestaudio[acodec=opus]/bestaudio");
                req.addOption("-o", dir.getAbsolutePath() + "/audio.%(ext)s");
                req.addOption("--no-playlist");
                req.addOption("--no-mtime");
                req.addOption("--write-info-json");
                req.addOption("--no-write-playlist-metafiles");
                req.addOption("--newline");
                YoutubeDL.getInstance().execute(req, jobId, (progress, eta, line) -> {
                    JSObject p = new JSObject();
                    p.put("jobId", jobId);
                    p.put("progress", progress);
                    p.put("eta", eta);
                    notifyListeners("progress", p);
                    return Unit.INSTANCE;
                });

                File audio = null;
                File info = null;
                File[] files = dir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f.getName().endsWith(".info.json")) info = f;
                        else if (f.getName().startsWith("audio.") && !f.getName().endsWith(".part")) audio = f;
                    }
                }
                if (audio == null) throw new Exception("yt-dlp finished without an audio file");

                JSObject ret = new JSObject();
                ret.put("path", audio.getAbsolutePath());
                ret.put("bytes", audio.length());
                ret.put("ext", audio.getName().substring(audio.getName().lastIndexOf('.') + 1));
                ret.put("info", info != null ? summary(info) : new JSObject());
                call.resolve(ret);
            } catch (YoutubeDL.CanceledException e) {
                deleteRecursive(dir);
                call.reject("Canceled", "canceled");
            } catch (Exception e) {
                deleteRecursive(dir);
                call.reject(shortError(e), "download_failed", e);
            }
        });
    }

    /** Only what the app needs from yt-dlp's (large) info file. */
    private JSObject summary(File info) throws Exception {
        JSONObject j = new JSONObject(new String(Files.readAllBytes(info.toPath()), StandardCharsets.UTF_8));
        JSObject s = new JSObject();
        for (String key : new String[] { "id", "title", "track", "artist", "creator", "album", "uploader", "channel", "acodec", "ext" }) {
            if (j.has(key) && !j.isNull(key)) s.put(key, j.optString(key));
        }
        if (j.has("artists") && j.optJSONArray("artists") != null) s.put("artists", j.optJSONArray("artists"));
        s.put("duration", j.optDouble("duration", 0));
        s.put("abr", j.optDouble("abr", 0));
        return s;
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String jobId = call.getString("jobId", "");
        JSObject ret = new JSObject();
        ret.put("canceled", YoutubeDL.getInstance().destroyProcessById(jobId));
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
                call.reject(shortError(e), "image_failed", e);
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    /** Removes a finished job's files (only inside the downloads folder). */
    @PluginMethod
    public void deleteFile(PluginCall call) {
        String path = call.getString("path", "");
        File f = new File(path);
        try {
            String root = workDir().getCanonicalPath();
            if (f.getCanonicalPath().startsWith(root + File.separator)) {
                File parent = f.getParentFile();
                deleteRecursive(f);
                if (parent != null && !parent.getCanonicalPath().equals(root)) {
                    String[] left = parent.list();
                    if (left == null || left.length == 0) parent.delete();
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not delete", e);
        }
    }

    /** Clears every leftover download (e.g. after the app was closed mid-download). */
    @PluginMethod
    public void clearAll(PluginCall call) {
        downloads.execute(() -> {
            deleteRecursive(workDir());
            call.resolve();
        });
    }

    /* ------------------------- progress notification ------------------------- */

    /** Shows/updates (active=true) or removes (active=false) the download notification. */
    @PluginMethod
    public void setNotification(PluginCall call) {
        Context ctx = getContext();
        boolean active = Boolean.TRUE.equals(call.getBoolean("active", false));
        Intent intent = new Intent(ctx, DownloadService.class);
        if (!active) {
            ctx.stopService(intent);
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
        intent.putExtra("title", title);
        intent.putExtra("text", text);
        intent.putExtra("progress", progress);
        try {
            ContextCompat.startForegroundService(ctx, intent);
            call.resolve();
        } catch (Exception e) {
            // Android refuses to start it from the background: downloads go on without it.
            call.resolve();
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
        downloads.shutdownNow();
        lookups.shutdownNow();
    }

    /* ---------------------------------- utils -------------------------------- */

    /** yt-dlp errors are long; keep the line that says what went wrong. */
    private static String shortError(Exception e) {
        String msg = e.getMessage() == null ? e.toString() : e.getMessage();
        for (String line : msg.split("\n")) {
            if (line.startsWith("ERROR:")) return line.length() > 400 ? line.substring(0, 400) : line;
        }
        msg = msg.trim();
        return msg.length() > 400 ? msg.substring(msg.length() - 400) : msg;
    }

    private static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) for (File c : children) deleteRecursive(c);
        }
        f.delete();
    }
}
