package io.github.ando144.askestream;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-specific native features: keep-awake, in-app updates, YouTube downloads.
        registerPlugin(AskeNativePlugin.class);
        registerPlugin(DownloaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
