package com.BeyTool.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

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
        resolveGranted(call, mediaGranted());
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (mediaGranted()) {
            resolveGranted(call, true);
            return;
        }
        requestForAlias(activeMediaAlias(), call);
    }

    /** Uygulama ayarlarını açar; izin kalıcı olarak reddedildiğinde kullanılır. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Ayarlar açılamadı.", error);
        }
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
        boolean granted =
            MEDIA_ALIAS.equals(alias)
                ? mediaGranted()
                : alias != null && isGranted(alias);
        resolveGranted(call, granted);
    }

    /**
     * Android 13+ medya erişimi: kullanıcı yalnızca fotoğraf/video izni vermiş
     * ya da Android 14'te "seçili fotoğraflar"ı seçmiş olabilir. Uygulama
     * dosyaları SAF seçiciyle açtığı için herhangi biri yeterlidir; hepsini
     * şart koşmak izin verilmiş görünürken "reddedildi" demeye yol açıyordu.
     */
    private boolean mediaGranted() {
        if (Build.VERSION.SDK_INT >= 33) {
            return granted(Manifest.permission.READ_MEDIA_IMAGES)
                || granted(Manifest.permission.READ_MEDIA_VIDEO)
                || granted(Manifest.permission.READ_MEDIA_AUDIO)
                || (Build.VERSION.SDK_INT >= 34
                    && granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED));
        }
        return granted(Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    private boolean granted(String permission) {
        return getContext().checkSelfPermission(permission)
            == PackageManager.PERMISSION_GRANTED;
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
