package io.github.ando144.askestream;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Small native helpers the web app cannot do by itself:
 *
 *  - keepAwake: while music plays with the screen off, keep the CPU and Wi-Fi
 *    awake so streaming does not stall (the media notification itself is run
 *    by the media-session plugin's foreground service).
 *  - in-app updates: download the new APK from GitHub Releases and open
 *    Android's installer. Android always asks the user to confirm, and only
 *    accepts an update signed with the same key as the installed app.
 */
@CapacitorPlugin(name = "AskeNative")
public class AskeNativePlugin extends Plugin {

    private static final String UPDATE_DIR = "updates";
    private static final long MAX_APK_BYTES = 200L * 1024 * 1024;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean downloading = false;

    /* ------------------------------ app info ------------------------------ */

    @PluginMethod
    public void appInfo(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageInfo info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("version", info.versionName);
            ret.put("build", Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
            ret.put("canInstallUpdates", canInstall());
            ret.put("androidVersion", Build.VERSION.RELEASE);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read the app version", e);
        }
    }

    /* ------------------------------ keep awake ---------------------------- */

    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        if (playing) acquireLocks();
        else releaseLocks();
        call.resolve();
    }

    private synchronized void acquireLocks() {
        Context ctx = getContext().getApplicationContext();
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AskeStream:playback");
            wakeLock.setReferenceCounted(false);
        }
        if (wifiLock == null) {
            WifiManager wm = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
            int mode = Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
            wifiLock = wm.createWifiLock(mode, "AskeStream:streaming");
            wifiLock.setReferenceCounted(false);
        }
        // Safety net: a forgotten lock is released after 6 hours anyway.
        wakeLock.acquire(6 * 60 * 60 * 1000L);
        if (!wifiLock.isHeld()) wifiLock.acquire();
    }

    private synchronized void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    }

    @Override
    protected void handleOnDestroy() {
        releaseLocks();
        executor.shutdownNow();
    }

    /* ------------------------------ updates ------------------------------- */

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    /** Downloads an APK (https only) into the app's private cache, reporting progress. */
    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        String url = call.getString("url");
        String version = call.getString("version", "new");
        if (url == null || !url.startsWith("https://")) {
            call.reject("The update address must start with https://", "bad_url");
            return;
        }
        if (downloading) {
            call.reject("An update is already downloading", "busy");
            return;
        }
        downloading = true;
        executor.execute(() -> {
            File dir = new File(getContext().getCacheDir(), UPDATE_DIR);
            File part = new File(dir, "download.part");
            File apk = new File(dir, "aske-stream-" + version.replaceAll("[^0-9A-Za-z._-]", "") + ".apk");
            HttpURLConnection conn = null;
            try {
                deleteRecursive(dir);
                if (!dir.mkdirs() && !dir.isDirectory()) throw new Exception("Cannot create " + dir);
                conn = open(url);
                long total = conn.getContentLengthLong();
                if (total > MAX_APK_BYTES) throw new Exception("The file is too big to be an update");
                long received = 0;
                long lastReport = 0;
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(part)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        received += n;
                        if (received > MAX_APK_BYTES) throw new Exception("The file is too big to be an update");
                        long now = System.currentTimeMillis();
                        if (now - lastReport > 250) {
                            lastReport = now;
                            JSObject p = new JSObject();
                            p.put("received", received);
                            p.put("total", total);
                            notifyListeners("updateProgress", p);
                        }
                    }
                }
                if (!part.renameTo(apk)) throw new Exception("Could not save the update");
                JSObject ret = new JSObject();
                ret.put("path", apk.getAbsolutePath());
                ret.put("bytes", received);
                call.resolve(ret);
            } catch (Exception e) {
                part.delete();
                call.reject("Download failed: " + e.getMessage(), "download_failed", e);
            } finally {
                if (conn != null) conn.disconnect();
                downloading = false;
            }
        });
    }

    /** GitHub sends release files through a redirect to another https host. */
    private HttpURLConnection open(String url) throws Exception {
        String current = url;
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(20_000);
            c.setReadTimeout(60_000);
            c.setRequestProperty("User-Agent", "AskeStream-Android");
            c.setRequestProperty("Accept", "application/octet-stream");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) {
                String next = c.getHeaderField("Location");
                c.disconnect();
                if (next == null) throw new Exception("Bad redirect");
                current = new URL(new URL(current), next).toString();
                if (!current.startsWith("https://")) throw new Exception("Insecure redirect");
                continue;
            }
            if (code != 200) {
                c.disconnect();
                throw new Exception("HTTP " + code);
            }
            return c;
        }
        throw new Exception("Too many redirects");
    }

    /** Opens Android's installer for a downloaded update. */
    @PluginMethod
    public void installUpdate(PluginCall call) {
        String path = call.getString("path");
        File apk = path == null ? null : new File(path);
        File dir = new File(getContext().getCacheDir(), UPDATE_DIR);
        if (apk == null || !apk.isFile() || !dir.equals(apk.getParentFile())) {
            call.reject("The downloaded update was not found", "missing");
            return;
        }
        if (!canInstall()) {
            call.reject("Installing updates is not allowed yet", "needs_permission");
            return;
        }
        Context ctx = getContext();
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the installer", "installer", e);
        }
    }

    /** Opens the system screen "Install unknown apps" for this app. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= 26) {
                intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open settings", e);
        }
    }

    private static void deleteRecursive(File f) {
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) for (File c : children) deleteRecursive(c);
        }
        f.delete();
    }
}
