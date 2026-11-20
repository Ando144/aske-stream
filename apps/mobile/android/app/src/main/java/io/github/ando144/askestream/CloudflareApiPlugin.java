package io.github.ando144.askestream;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Talks to the Cloudflare API on behalf of the web app (no CORS from the WebView).
 * The host is fixed. The token, URLs and bodies are never logged.
 */
@CapacitorPlugin(name = "CloudflareApi")
public class CloudflareApiPlugin extends Plugin {

    private static final String BASE = "https://api.cloudflare.com/client/v4";
    private static final int CONNECT_TIMEOUT_MS = 30_000;
    private static final int READ_TIMEOUT_MS = 120_000;

    private final ExecutorService executor = Executors.newCachedThreadPool();

    /** Resolves {status, body}; rejects with "network" when there is no connection. */
    @PluginMethod
    public void request(PluginCall call) {
        String method = call.getString("method");
        String path = call.getString("path");
        String bearer = call.getString("bearer");
        if (method == null || bearer == null || !isSafePath(path)) {
            call.reject("Invalid request", "invalid");
            return;
        }
        Object json = call.getData().opt("json");
        JSArray form = call.getArray("form");
        executor.execute(() -> execute(call, method, path, bearer, json, form));
    }

    static boolean isSafePath(String path) {
        return path != null
            && path.startsWith("/")
            && !path.contains("..")
            && !path.contains("://")
            && !path.contains("@");
    }

    private void execute(PluginCall call, String method, String path, String bearer, Object json, JSArray form) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(BASE + path).openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setRequestMethod(method);
            conn.setRequestProperty("Authorization", "Bearer " + bearer);
            byte[] payload = null;
            if (form != null) {
                String boundary = "----aske" + UUID.randomUUID().toString().replace("-", "");
                conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                payload = buildMultipart(form, boundary);
            } else if (json != null && json != JSONObject.NULL) {
                conn.setRequestProperty("Content-Type", "application/json");
                payload = json.toString().getBytes(StandardCharsets.UTF_8);
            }
            if (payload != null) {
                conn.setDoOutput(true);
                try (OutputStream out = conn.getOutputStream()) {
                    out.write(payload);
                }
            }
            int status = conn.getResponseCode();
            JSObject ret = new JSObject();
            ret.put("status", status);
            ret.put("body", readAll(status >= 400 ? conn.getErrorStream() : conn.getInputStream()));
            call.resolve(ret);
        } catch (IOException e) {
            call.reject("No connection", "network");
        } catch (Exception e) {
            call.reject("The request could not be completed", "unknown");
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static byte[] buildMultipart(JSArray form, String boundary) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        JSONArray parts = form;
        for (int i = 0; i < parts.length(); i++) {
            JSONObject part = parts.getJSONObject(i);
            StringBuilder head = new StringBuilder("--").append(boundary).append("\r\n");
            head.append("Content-Disposition: form-data; name=\"")
                .append(escapeQuotes(part.getString("name"))).append("\"");
            String filename = part.optString("filename", null);
            if (filename != null) head.append("; filename=\"").append(escapeQuotes(filename)).append("\"");
            head.append("\r\n");
            String type = part.optString("contentType", null);
            if (type != null) head.append("Content-Type: ").append(type).append("\r\n");
            head.append("\r\n");
            out.write(head.toString().getBytes(StandardCharsets.UTF_8));
            out.write(part.getString("value").getBytes(StandardCharsets.UTF_8));
            out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private static String escapeQuotes(String value) {
        return value.replace("\"", "%22").replace("\r", "").replace("\n", "");
    }

    private static String readAll(InputStream in) throws IOException {
        if (in == null) return "";
        try (InputStream stream = in; ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int n;
            while ((n = stream.read(chunk)) != -1) buf.write(chunk, 0, n);
            return buf.toString("UTF-8");
        }
    }
}
