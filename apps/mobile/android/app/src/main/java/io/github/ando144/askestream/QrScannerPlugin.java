package io.github.ando144.askestream;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

/**
 * QR scanner using Google's code scanner (Google Play services). Google's own
 * screen does the scanning, so the app needs no camera permission. The scanned
 * text is only handed back to the web app: it is never logged or stored here.
 */
@CapacitorPlugin(name = "QrScanner")
public class QrScannerPlugin extends Plugin {

    /** Resolves {text}; rejects with "cancelled" (user closed it) or "unavailable". */
    @PluginMethod
    public void scan(PluginCall call) {
        GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build();
        try {
            GmsBarcodeScanning.getClient(getActivity(), options)
                .startScan()
                .addOnSuccessListener(barcode -> resolveWith(call, barcode))
                .addOnCanceledListener(() -> call.reject("The scanner was closed", "cancelled"))
                .addOnFailureListener(e -> call.reject("The QR scanner is not available", "unavailable", e));
        } catch (Exception e) {
            call.reject("The QR scanner is not available", "unavailable", e);
        }
    }

    private void resolveWith(PluginCall call, Barcode barcode) {
        String text = barcode.getRawValue();
        if (text == null) {
            call.reject("The QR code could not be read", "unavailable");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("text", text);
        call.resolve(ret);
    }
}
