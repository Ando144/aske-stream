package io.github.ando144.askestream;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Study mode helpers: screen pinning (Android asks the user to confirm) and an
 * end-of-session chime that also rings when the web view is asleep.
 */
@CapacitorPlugin(name = "StudyLock")
public class StudyLockPlugin extends Plugin {

    private static final int CHIME_REQUEST_CODE = 4210;

    @PluginMethod
    public void pin(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            try {
                activity.startLockTask();
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not pin the screen", e);
            }
        });
    }

    @PluginMethod
    public void unpin(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            try {
                activity.stopLockTask();
            } catch (Exception ignored) {
                // Not pinned: nothing to undo.
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("pin", pinState());
        long last = ChimePlayer.lastChimedEndsAt(getContext());
        ret.put("lastChimedEndsAt", last < 0 ? JSObject.NULL : last);
        call.resolve(ret);
    }

    @PluginMethod
    public void scheduleChime(PluginCall call) {
        Long endsAt = call.getData().has("endsAt") ? call.getData().optLong("endsAt") : null;
        if (endsAt == null) {
            call.reject("endsAt is required");
            return;
        }
        AlarmManager alarms = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        PendingIntent pending = chimeIntent(endsAt);
        boolean exact = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms();
        if (exact) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pending);
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pending);
        }
        JSObject ret = new JSObject();
        ret.put("exact", exact);
        call.resolve(ret);
    }

    @PluginMethod
    public void cancelChime(PluginCall call) {
        cancelAlarm();
        call.resolve();
    }

    @PluginMethod
    public void chimeNow(PluginCall call) {
        if (!call.getData().has("endsAt")) {
            call.reject("endsAt is required");
            return;
        }
        long endsAt = call.getData().optLong("endsAt");
        cancelAlarm();
        ChimePlayer.playOnce(getContext(), endsAt);
        call.resolve();
    }

    @PluginMethod
    public void openPinSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the settings", e);
        }
    }

    private String pinState() {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        switch (am.getLockTaskModeState()) {
            case ActivityManager.LOCK_TASK_MODE_PINNED:
                return "pinned";
            case ActivityManager.LOCK_TASK_MODE_LOCKED:
                return "locked";
            default:
                return "none";
        }
    }

    private PendingIntent chimeIntent(long endsAt) {
        Intent intent = new Intent(getContext(), StudyChimeReceiver.class);
        intent.putExtra(StudyChimeReceiver.EXTRA_ENDS_AT, endsAt);
        return PendingIntent.getBroadcast(
            getContext(),
            CHIME_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }

    private void cancelAlarm() {
        AlarmManager alarms = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        alarms.cancel(chimeIntent(0L));
    }
}
