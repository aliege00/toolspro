package com.medya.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * Cihaz medya izinlerini (READ_MEDIA_IMAGES / VIDEO / AUDIO, Android 13+;
 * READ_EXTERNAL_STORAGE, daha eski sürümler) JavaScript tarafına açar.
 */
@CapacitorPlugin(name = "MediaPermissions")
public class MediaPermissionsPlugin extends Plugin {

    private static final int REQUEST_CODE = 57123;
    private PluginCall pendingCall;

    @PluginMethod
    public void check(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", allGranted());
        call.resolve(result);
    }

    @PluginMethod
    public void request(PluginCall call) {
        List<String> missing = new ArrayList<>();
        for (String permission : requiredPermissions()) {
            if (getContext().checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                missing.add(permission);
            }
        }

        if (missing.isEmpty()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        pendingCall = call;
        requestPermissions(missing.toArray(new String[0]), REQUEST_CODE);
    }

    @Override
    public void handleOnRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.handleOnRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != REQUEST_CODE || pendingCall == null) {
            return;
        }

        boolean granted = grantResults.length > 0;
        for (int grantResult : grantResults) {
            if (grantResult != PackageManager.PERMISSION_GRANTED) {
                granted = false;
                break;
            }
        }

        JSObject result = new JSObject();
        result.put("granted", granted);
        pendingCall.resolve(result);
        pendingCall = null;
    }

    private boolean allGranted() {
        for (String permission : requiredPermissions()) {
            if (getContext().checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    private String[] requiredPermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            return new String[]{
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_AUDIO
            };
        }
        return new String[]{ Manifest.permission.READ_EXTERNAL_STORAGE };
    }
}
