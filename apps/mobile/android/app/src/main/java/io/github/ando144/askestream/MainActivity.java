package io.github.ando144.askestream;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-specific native features (keep-awake while playing, in-app updates).
        registerPlugin(AskeNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
