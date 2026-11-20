package io.github.ando144.askestream;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

/** Tells whether the phone has working internet and calls back when it comes back. */
final class NetworkWatcher extends ConnectivityManager.NetworkCallback {

    private final ConnectivityManager manager;
    private final Runnable onValidated;
    private boolean started = false;

    NetworkWatcher(Context ctx, Runnable onValidated) {
        this.manager = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
        this.onValidated = onValidated;
    }

    void start() {
        if (started) return;
        manager.registerDefaultNetworkCallback(this);
        started = true;
    }

    void stop() {
        if (!started) return;
        manager.unregisterNetworkCallback(this);
        started = false;
    }

    /** True when the active network has been checked by Android to reach the internet. */
    boolean hasValidatedInternet() {
        Network active = manager.getActiveNetwork();
        if (active == null) return false;
        NetworkCapabilities caps = manager.getNetworkCapabilities(active);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    @Override
    public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
        if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) onValidated.run();
    }
}
