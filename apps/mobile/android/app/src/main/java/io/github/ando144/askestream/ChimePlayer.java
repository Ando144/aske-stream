package io.github.ando144.askestream;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Handler;
import android.os.Looper;

/**
 * End-of-study-session chime: three synthesized bell strikes, no audio files.
 * It plays without requesting audio focus so the WebView does not pause the music.
 */
final class ChimePlayer {

    private static final String PREFS = "aske-study";
    private static final String KEY_LAST = "lastChimedEndsAt";
    private static final int SAMPLE_RATE = 44_100;
    private static final int STRIKES = 3;
    private static final double STRIKE_SECONDS = 2.2;
    private static final double DECAY_TAU = 0.9;
    private static final double PEAK = 0.35;
    private static final double[] FREQS = {880.0, 1318.5, 2637.0};
    private static final double[] WEIGHTS = {0.6, 0.25, 0.1};

    private ChimePlayer() {}

    /** Plays the chime once per endsAt; later calls with the same endsAt do nothing. */
    static synchronized void playOnce(Context context, long endsAt) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (prefs.contains(KEY_LAST) && prefs.getLong(KEY_LAST, 0L) == endsAt) return;
        // Mark first: a crash while playing must never make the chime ring twice.
        prefs.edit().putLong(KEY_LAST, endsAt).apply();
        play(synthesize());
    }

    /** Last endsAt that rang, or -1 if none. */
    static long lastChimedEndsAt(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return prefs.contains(KEY_LAST) ? prefs.getLong(KEY_LAST, -1L) : -1L;
    }

    private static short[] synthesize() {
        int perStrike = (int) (STRIKE_SECONDS * SAMPLE_RATE);
        short[] pcm = new short[perStrike * STRIKES];
        for (int strike = 0; strike < STRIKES; strike++) {
            for (int i = 0; i < perStrike; i++) {
                double t = (double) i / SAMPLE_RATE;
                pcm[strike * perStrike + i] = (short) (bellSample(t) * PEAK * Short.MAX_VALUE);
            }
        }
        return pcm;
    }

    private static double bellSample(double t) {
        double sum = 0;
        for (int k = 0; k < FREQS.length; k++) {
            sum += WEIGHTS[k] * Math.sin(2 * Math.PI * FREQS[k] * t);
        }
        // Short linear attack avoids a click at the start of each strike.
        double attack = Math.min(1.0, t / 0.005);
        return sum * attack * Math.exp(-t / DECAY_TAU);
    }

    private static void play(short[] pcm) {
        AudioTrack track = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build())
            .setAudioFormat(new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(SAMPLE_RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build())
            .setBufferSizeInBytes(pcm.length * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build();
        track.write(pcm, 0, pcm.length);
        track.play();
        long millis = pcm.length * 1000L / SAMPLE_RATE + 300L;
        new Handler(Looper.getMainLooper()).postDelayed(track::release, millis);
    }
}
