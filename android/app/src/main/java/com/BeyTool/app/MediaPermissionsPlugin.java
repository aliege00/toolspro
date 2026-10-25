package com.BeyTool.app;

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
 * Cihaz izinlerini JavaScript tarafına açar:
 * - medya (Android 13+: READ_MEDIA_IMAGES/VIDEO/AUDIO, eski: READ_EXTERNAL_STORAGE)
 * - kamera (QR tarama)
 * - mikrofon (ses kaydedici)
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
        ),
        @Permission(
            alias = MediaPermissionsPlugin.CAMERA_ALIAS,
            strings = { Manifest.permission.CAMERA }
        ),
        @Permission(
            alias = MediaPermissionsPlugin.MIC_ALIAS,
            strings = { Manifest.permission.RECORD_AUDIO }
        ),
        @Permission(
            alias = MediaPermissionsPlugin.NOTIF_ALIAS,
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class MediaPermissionsPlugin extends Plugin {

    static final String MEDIA_ALIAS = "media";
    static final String STORAGE_ALIAS = "storage";
    static final String CAMERA_ALIAS = "camera";
    static final String MIC_ALIAS = "mic";
    static final String NOTIF_ALIAS = "notifications";

    private String pendingAlias;

    @PluginMethod
    public void check(PluginCall call) {
        resolveGranted(call, isGranted(activeMediaAlias()));
    }

    @PluginMethod
    public void request(PluginCall call) {
        requestForAlias(activeMediaAlias(), call);
    }

    @PluginMethod
    public void requestCamera(PluginCall call) {
        requestForAlias(CAMERA_ALIAS, call);
    }

    @PluginMethod
    public void requestMic(PluginCall call) {
        requestForAlias(MIC_ALIAS, call);
    }

    /** Android 13+ bildirim izni; daha eski sürümlerde izin gerekmez. */
    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33) {
            resolveGranted(call, true);
            return;
        }
        requestForAlias(NOTIF_ALIAS, call);
    }

    private void requestForAlias(String alias, PluginCall call) {
        if (isGranted(alias)) {
            resolveGranted(call, true);
            return;
        }
        pendingAlias = alias;
        requestPermissionForAlias(alias, call, "aliasPermissionCallback");
    }

    @PermissionCallback
    private void aliasPermissionCallback(PluginCall call) {
        String alias = pendingAlias;
        pendingAlias = null;
        resolveGranted(call, alias != null && isGranted(alias));
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    private boolean isGranted(String alias) {
        return getPermissionState(alias) == PermissionState.GRANTED;
    }

    private String activeMediaAlias() {
        if (Build.VERSION.SDK_INT >= 33) {
            return MEDIA_ALIAS;
        }
        return STORAGE_ALIAS;
    }
}
