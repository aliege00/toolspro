package com.medya.app;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Cihaz medya izinlerini JavaScript tarafına açar.
 * Android 13+ (API 33) ve üzeri: READ_MEDIA_IMAGES / VIDEO / AUDIO
 * Daha eski sürümler: READ_EXTERNAL_STORAGE
 */
@CapacitorPlugin(
    name = "MediaPermissions",
    permissions = {
        @Permission(
            alias = MediaPermissionsPlugin.MEDIA_ALIAS,
            strings = {
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_AUDIO
            }
        ),
        @Permission(
            alias = MediaPermissionsPlugin.STORAGE_ALIAS,
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        )
    }
)
public class MediaPermissionsPlugin extends Plugin {

    static final String MEDIA_ALIAS = "media";
    static final String STORAGE_ALIAS = "storage";

    @PluginMethod
    public void check(PluginCall call) {
        resolveGranted(call, isGranted());
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (isGranted()) {
            resolveGranted(call, true);
            return;
        }
        requestPermissionForAlias(activeAlias(), call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        resolveGranted(call, isGranted());
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    private boolean isGranted() {
        return getPermissionState(activeAlias()) == PermissionState.GRANTED;
    }

    private String activeAlias() {
        return Build.VERSION.SDK_INT >= 33 ? MEDIA_ALIAS : STORAGE_ALIAS;
    }
}
