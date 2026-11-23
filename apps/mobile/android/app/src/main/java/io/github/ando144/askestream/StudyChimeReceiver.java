package io.github.ando144.askestream;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fired by the alarm set in StudyLockPlugin: rings the chime if JS did not. */
public class StudyChimeReceiver extends BroadcastReceiver {

    static final String EXTRA_ENDS_AT = "endsAt";

    @Override
    public void onReceive(Context context, Intent intent) {
        long endsAt = intent.getLongExtra(EXTRA_ENDS_AT, -1L);
        if (endsAt < 0) return;
        PendingResult result = goAsync();
        Context app = context.getApplicationContext();
        new Thread(() -> {
            try {
                ChimePlayer.playOnce(app, endsAt);
            } finally {
                result.finish();
            }
        }).start();
    }
}
