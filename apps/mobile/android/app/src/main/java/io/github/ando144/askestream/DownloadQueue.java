package io.github.ando144.askestream;

import android.content.Context;
import android.util.Log;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The phone's own download queue. It lives in filesDir/downloads-queue.json and is saved after
 * every change, so it survives the app being closed or the process being killed.
 */
final class DownloadQueue {

    static final class Job {
        final String jobId;
        final String videoId;
        int attempts;

        Job(String jobId, String videoId, int attempts) {
            this.jobId = jobId;
            this.videoId = videoId;
            this.attempts = attempts;
        }
    }

    private static final String TAG = "DownloadQueue";
    private static DownloadQueue instance;

    private final Context ctx;
    private final File file;
    private final LinkedList<Job> queue = new LinkedList<>();
    private final List<JSObject> results = new ArrayList<>();
    private Job current;
    private JSObject texts = new JSObject();

    static synchronized DownloadQueue get(Context context) {
        if (instance == null) instance = new DownloadQueue(context.getApplicationContext());
        return instance;
    }

    private DownloadQueue(Context ctx) {
        this.ctx = ctx;
        this.file = new File(ctx.getFilesDir(), "downloads-queue.json");
        load();
    }

    /** Appends jobs, skipping ids already queued, running or finished. Keeps the latest texts. */
    synchronized void add(List<Job> jobs, JSObject newTexts) {
        for (Job j : jobs) {
            if (!isKnown(j.jobId)) queue.addLast(j);
        }
        if (newTexts != null) texts = newTexts;
        save();
    }

    private boolean isKnown(String jobId) {
        if (current != null && current.jobId.equals(jobId)) return true;
        for (Job q : queue) if (q.jobId.equals(jobId)) return true;
        for (JSObject r : results) if (jobId.equals(r.optString("jobId"))) return true;
        return false;
    }

    /** Takes the next job and marks it as the one being downloaded. */
    synchronized Job takeNext() {
        if (current != null) return null;
        current = queue.pollFirst();
        save();
        return current;
    }

    /** Puts the running job back at the front (network failure), optionally counting an attempt. */
    synchronized void requeueCurrent(boolean countAttempt) {
        if (current == null) return;
        if (countAttempt) current.attempts++;
        queue.addFirst(current);
        current = null;
        save();
    }

    synchronized void finish(JSObject result) {
        current = null;
        String id = result.optString("jobId");
        results.removeIf(r -> id.equals(r.optString("jobId")));
        results.add(result);
        save();
    }

    /** Forgets a result and deletes its files. */
    synchronized void ack(String jobId) {
        results.removeIf(r -> jobId.equals(r.optString("jobId")));
        DownloadWorker.deleteJobFolder(ctx, jobId);
        save();
    }

    /** Removes a job that has not started yet. */
    synchronized boolean remove(String jobId) {
        boolean removed = queue.removeIf(j -> j.jobId.equals(jobId));
        if (removed) save();
        return removed;
    }

    synchronized boolean isCurrent(String jobId) {
        return current != null && current.jobId.equals(jobId);
    }

    synchronized boolean hasWork() {
        return current != null || !queue.isEmpty();
    }

    synchronized int pendingCount() {
        return queue.size() + (current != null ? 1 : 0);
    }

    synchronized int resultCount() {
        return results.size();
    }

    synchronized JSObject texts() {
        return texts;
    }

    synchronized JSObject snapshot() {
        JSObject s = new JSObject();
        JSONArray ids = new JSONArray();
        for (Job j : queue) ids.put(j.jobId);
        s.put("queued", ids);
        s.put("current", current != null ? current.jobId : JSONObject.NULL);
        s.put("results", new JSONArray(results));
        return s;
    }

    /* ------------------------------ persistence ------------------------------ */

    private void load() {
        try {
            if (!file.isFile()) return;
            JSONObject root = new JSONObject(readFile());
            JSONObject cur = root.optJSONObject("current");
            if (cur != null) queue.add(readJob(cur));
            JSONArray q = root.optJSONArray("queue");
            for (int i = 0; q != null && i < q.length(); i++) queue.add(readJob(q.getJSONObject(i)));
            JSONArray r = root.optJSONArray("results");
            for (int i = 0; r != null && i < r.length(); i++) results.add(new JSObject(r.getJSONObject(i).toString()));
            JSONObject t = root.optJSONObject("texts");
            if (t != null) texts = new JSObject(t.toString());
        } catch (Exception e) {
            // A damaged file must not block downloads: start with an empty queue.
            Log.w(TAG, "Could not read the saved queue: " + e);
        }
    }

    private String readFile() throws Exception {
        try (FileInputStream in = new FileInputStream(file)) {
            java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return buf.toString("UTF-8");
        }
    }

    private static Job readJob(JSONObject o) {
        return new Job(o.optString("jobId"), o.optString("videoId"), o.optInt("attempts", 0));
    }

    private JSONObject writeJob(Job j) throws Exception {
        return new JSONObject().put("jobId", j.jobId).put("videoId", j.videoId).put("attempts", j.attempts);
    }

    private void save() {
        try {
            JSONObject root = new JSONObject();
            JSONArray q = new JSONArray();
            for (Job j : queue) q.put(writeJob(j));
            root.put("queue", q);
            if (current != null) root.put("current", writeJob(current));
            root.put("results", new JSONArray(results));
            root.put("texts", texts);
            File tmp = new File(file.getPath() + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(root.toString().getBytes(StandardCharsets.UTF_8));
            }
            if (!tmp.renameTo(file)) throw new Exception("rename failed");
        } catch (Exception e) {
            Log.w(TAG, "Could not save the queue: " + e);
        }
    }
}
