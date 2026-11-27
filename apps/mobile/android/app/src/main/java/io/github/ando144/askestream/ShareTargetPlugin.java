package io.github.ando144.askestream;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * Receives "Share → Aske Stream" from YouTube and other apps. The text is only
 * handed to the web app, which checks it: it is never logged or stored here.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private static final int MAX_TEXT_LENGTH = 2000;

    /** Text that opened the app, kept until the web app is ready to ask for it. */
    private String pending;

    @Override
    public void load() {
        pending = consumeSharedText(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String text = consumeSharedText(intent);
        if (text == null) {
            return;
        }
        JSObject data = new JSObject();
        data.put("text", text);
        // Retained: the share is not lost if the web app is not listening yet.
        notifyListeners("shared", data, true);
    }

    /** Resolves {text: string | null} and forgets it. */
    @PluginMethod
    public void takePending(PluginCall call) {
        JSObject ret = new JSObject();
        // JSONObject.NULL keeps the key: put(key, null) would drop it.
        ret.put("text", pending == null ? JSONObject.NULL : pending);
        pending = null;
        call.resolve(ret);
    }

    /** The shared text of the intent (or null), marking the intent as already handled. */
    private String consumeSharedText(Intent intent) {
        if (intent == null
                || !Intent.ACTION_SEND.equals(intent.getAction())
                || !"text/plain".equals(intent.getType())) {
            return null;
        }
        // Reopening from "recent apps" replays the original intent: that is not a new share.
        boolean replayed = (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        // So that recreating the activity does not repeat it.
        intent.setAction(Intent.ACTION_MAIN);
        if (replayed || text == null) {
            return null;
        }
        return text.subSequence(0, Math.min(text.length(), MAX_TEXT_LENGTH)).toString();
    }
}
