package io.github.ando144.askestream;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-specific native features: keep-awake, in-app updates, YouTube downloads, Google Drive.
        registerPlugin(ShareTargetPlugin.class);
        registerPlugin(AskeNativePlugin.class);
        registerPlugin(DownloaderPlugin.class);
        registerPlugin(GoogleDrivePlugin.class);
        registerPlugin(QrScannerPlugin.class);
        registerPlugin(CloudflareApiPlugin.class);
        registerPlugin(StudyLockPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
