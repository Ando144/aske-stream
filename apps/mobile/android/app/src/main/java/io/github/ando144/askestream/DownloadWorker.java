package io.github.ando144.askestream;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import java.io.File;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import kotlin.Unit;
import org.json.JSONArray;
import org.json.JSONObject;

/** Runs one yt-dlp download. Everything that touches yt-dlp runs on the single shared thread. */
final class DownloadWorker {

    /** Receives yt-dlp progress (0-100) while a job downloads. */
    interface ProgressSink {
        void onProgress(String jobId, float progress, long eta);
    }

    /** One thread for downloads and engine updates, so they never run at the same time. */
    static final ExecutorService EXEC = Executors.newSingleThreadExecutor();

    private static final String DIR = "yt-downloads";
    private static final String[] NETWORK_HINTS = {
        "UnknownHost", "timed out", "Connection", "Unable to download", "network", "Network",
    };
    private static boolean ready = false;

    private DownloadWorker() {}

    static synchronized void ensureReady(Context ctx) throws Exception {
        if (ready) return;
        YoutubeDL.getInstance().init(ctx.getApplicationContext());
        ready = true;
    }

    static File rootDir(Context ctx) {
        return new File(ctx.getFilesDir(), DIR);
    }

    /** A usable id is non-null and not empty once sanitized; otherwise it would point at rootDir. */
    static boolean isValidJobId(String id) {
        return id != null && !id.replaceAll("[^\\w-]", "").isEmpty();
    }

    static File jobDir(Context ctx, String jobId) {
        return new File(rootDir(ctx), jobId.replaceAll("[^\\w-]", ""));
    }

    static void deleteJobFolder(Context ctx, String jobId) {
        if (!isValidJobId(jobId)) return;
        deleteRecursive(jobDir(ctx, jobId));
    }

    /** Downloads the audio of one video (Opus kept as-is) and returns the result to report. */
    static JSObject run(Context ctx, DownloadQueue.Job job, ProgressSink sink) {
        File dir = jobDir(ctx, job.jobId);
        long started = System.currentTimeMillis();
        try {
            ensureReady(ctx);
            deleteRecursive(dir);
            dir.mkdirs();
            YoutubeDL.getInstance().execute(buildRequest(job.videoId, dir), job.jobId, (progress, eta, line) -> {
                sink.onProgress(job.jobId, progress, eta);
                return Unit.INSTANCE;
            });
            return success(job.jobId, dir, System.currentTimeMillis() - started);
        } catch (YoutubeDL.CanceledException e) {
            deleteRecursive(dir);
            return failure(job.jobId, "Canceled", "canceled");
        } catch (Exception e) {
            deleteRecursive(dir);
            String line = shortError(e);
            return failure(job.jobId, line, isNetworkError(line) ? "network" : "download_failed");
        }
    }

    private static YoutubeDLRequest buildRequest(String videoId, File dir) {
        YoutubeDLRequest req = new YoutubeDLRequest("https://www.youtube.com/watch?v=" + videoId);
        req.addOption("-f", "bestaudio[ext=webm]/bestaudio[acodec=opus]/bestaudio");
        req.addOption("-o", dir.getAbsolutePath() + "/audio.%(ext)s");
        req.addOption("--no-playlist");
        req.addOption("--no-mtime");
        req.addOption("--write-info-json");
        req.addOption("--no-write-playlist-metafiles");
        req.addOption("--newline");
        req.addOption("--socket-timeout", "30");
        req.addOption("--retries", "3");
        return req;
    }

    private static JSObject success(String jobId, File dir, long elapsedMs) throws Exception {
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
        JSObject r = new JSObject();
        r.put("jobId", jobId);
        r.put("ok", true);
        r.put("path", audio.getAbsolutePath());
        r.put("bytes", audio.length());
        r.put("ext", audio.getName().substring(audio.getName().lastIndexOf('.') + 1));
        r.put("info", info != null ? summary(info) : new JSObject());
        r.put("elapsedMs", elapsedMs);
        return r;
    }

    private static JSObject failure(String jobId, String error, String code) {
        JSObject r = new JSObject();
        r.put("jobId", jobId);
        r.put("ok", false);
        r.put("error", error);
        r.put("code", code);
        return r;
    }

    /** Only what the app needs from yt-dlp's (large) info file. */
    private static JSObject summary(File info) throws Exception {
        JSONObject j = new JSONObject(readText(info));
        JSObject s = new JSObject();
        for (String key : new String[] { "id", "title", "track", "artist", "creator", "album", "uploader", "channel", "acodec", "ext" }) {
            if (j.has(key) && !j.isNull(key)) s.put(key, j.optString(key));
        }
        JSONArray artists = j.optJSONArray("artists");
        if (artists != null) s.put("artists", artists);
        s.put("duration", j.optDouble("duration", 0));
        s.put("abr", j.optDouble("abr", 0));
        return s;
    }

    private static String readText(File f) throws Exception {
        try (FileInputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return buf.toString("UTF-8");
        }
    }

    static boolean isNetworkError(String message) {
        for (String hint : NETWORK_HINTS) if (message.contains(hint)) return true;
        return false;
    }

    /** yt-dlp errors are long; keep the line that says what went wrong. */
    static String shortError(Exception e) {
        String msg = e.getMessage() == null ? e.toString() : e.getMessage();
        for (String line : msg.split("\n")) {
            if (line.startsWith("ERROR:")) return line.length() > 400 ? line.substring(0, 400) : line;
        }
        msg = msg.trim();
        return msg.length() > 400 ? msg.substring(msg.length() - 400) : msg;
    }

    static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) for (File c : children) deleteRecursive(c);
        }
        f.delete();
    }
}
