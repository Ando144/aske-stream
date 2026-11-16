package io.github.ando144.askestream;

import android.accounts.Account;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;
import java.util.List;

/**
 * Access to the user's Google Drive with Google's own Android authorisation
 * (Google Play services). Only the "drive.file" permission is requested: the
 * app sees the files it creates, nothing else in the user's Drive.
 *
 * There is no password or long-lived token stored by the app: every time an
 * access token is needed, Android hands out a fresh one (silently once the
 * user has agreed once).
 */
@CapacitorPlugin(name = "GoogleDrive", requestCodes = { GoogleDrivePlugin.REQ_AUTHORIZE })
public class GoogleDrivePlugin extends Plugin {

    static final int REQ_AUTHORIZE = 7311;
    private static final String DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";
    private static final List<Scope> SCOPES = Collections.singletonList(new Scope(DRIVE_FILE));

    private String pendingCallId;
    private Account lastAccount;

    private AuthorizationRequest request() {
        return AuthorizationRequest.builder().setRequestedScopes(SCOPES).build();
    }

    /** {interactive}: when false, never shows anything (fails with "consent_required"). */
    @PluginMethod
    public void authorize(PluginCall call) {
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        Activity activity = getActivity();
        Identity.getAuthorizationClient(activity)
            .authorize(request())
            .addOnSuccessListener(result -> {
                if (!result.hasResolution()) {
                    resolveWith(call, result);
                    return;
                }
                if (!interactive) {
                    call.reject("Google access needs your confirmation", "consent_required");
                    return;
                }
                PendingIntent pending = result.getPendingIntent();
                if (pending == null) {
                    call.reject("Google did not offer a way to sign in", "no_resolution");
                    return;
                }
                bridge.saveCall(call);
                pendingCallId = call.getCallbackId();
                try {
                    activity.startIntentSenderForResult(pending.getIntentSender(), REQ_AUTHORIZE, null, 0, 0, 0, null);
                } catch (Exception e) {
                    pendingCallId = null;
                    bridge.releaseCall(call);
                    call.reject("Could not open Google sign-in", "launch_failed", e);
                }
            })
            .addOnFailureListener(e -> call.reject(failureMessage(e), "authorize_failed", e));
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_AUTHORIZE || pendingCallId == null) return;
        PluginCall call = bridge.getSavedCall(pendingCallId);
        pendingCallId = null;
        if (call == null) return;
        bridge.releaseCall(call);
        if (resultCode != Activity.RESULT_OK) {
            call.reject("You closed the Google window", "canceled");
            return;
        }
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(data);
            resolveWith(call, result);
        } catch (Exception e) {
            call.reject(failureMessage(e), "authorize_failed", e);
        }
    }

    private void resolveWith(PluginCall call, AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null) {
            call.reject("Google did not return access", "no_token");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("accessToken", token);
        JSArray scopes = new JSArray();
        for (String s : result.getGrantedScopes()) scopes.put(s);
        ret.put("scopes", scopes);
        try {
            GoogleSignInAccount account = result.toGoogleSignInAccount();
            if (account != null) {
                lastAccount = account.getAccount();
                ret.put("email", account.getEmail());
            }
        } catch (Exception ignored) {
            // the e-mail is only a nicety
        }
        call.resolve(ret);
    }

    /** Removes Aske Stream's access to Drive (the files stay in Drive). */
    @PluginMethod
    public void revoke(PluginCall call) {
        if (lastAccount == null) {
            call.resolve();
            return;
        }
        RevokeAccessRequest req = RevokeAccessRequest.builder()
            .setAccount(lastAccount)
            .setScopes(SCOPES)
            .build();
        Identity.getAuthorizationClient(getActivity())
            .revokeAccess(req)
            .addOnSuccessListener(v -> call.resolve())
            .addOnFailureListener(e -> call.resolve());
    }

    private static String failureMessage(Exception e) {
        String m = e.getMessage();
        if (m != null && m.contains("10:")) {
            return "This copy of the app is not registered with Google (DEVELOPER_ERROR 10)";
        }
        return m == null ? e.toString() : m;
    }
}
