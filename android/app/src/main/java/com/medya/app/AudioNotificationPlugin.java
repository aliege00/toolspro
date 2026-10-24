package com.medya.app;

import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * WebView'daki ses çaların kilit ekranı/bildirim kontrollerini yönetir.
 * Bildirim eylemleri "action" olayı olarak JS'e geri gönderilir.
 */
@CapacitorPlugin(name = "AudioNotification")
public class AudioNotificationPlugin extends Plugin {

    private final AudioNotificationService.ActionListener listener = (action, positionMs) -> {
        if (getBridge() == null) return;
        getBridge().executeOnMainThread(() -> {
            JSObject data = new JSObject();
            data.put("action", action);
            data.put("position", positionMs / 1000.0);
            notifyListeners("action", data);
        });
    };

    @Override
    public void load() {
        AudioNotificationService.setActionListener(listener);
    }

    @Override
    protected void handleOnDestroy() {
        AudioNotificationService.setActionListener(null);
    }

    @PluginMethod
    public void start(PluginCall call) {
        send(call, AudioNotificationService.ACTION_START);
    }

    @PluginMethod
    public void update(PluginCall call) {
        send(call, AudioNotificationService.ACTION_UPDATE);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), AudioNotificationService.class);
        intent.setAction(AudioNotificationService.ACTION_STOP);
        try {
            getContext().startService(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Bildirim kapatılamadı.");
        }
    }

    private void send(PluginCall call, String action) {
        Intent intent = new Intent(getContext(), AudioNotificationService.class);
        intent.setAction(action);
        intent.putExtra("title", call.getString("title", "Medya"));
        Double duration = call.getDouble("duration", 0.0);
        Double position = call.getDouble("position", 0.0);
        intent.putExtra("duration", Math.round((duration != null ? duration : 0.0) * 1000));
        intent.putExtra("position", Math.round((position != null ? position : 0.0) * 1000));
        intent.putExtra("playing", Boolean.TRUE.equals(call.getBoolean("playing", false)));

        try {
            if (AudioNotificationService.ACTION_UPDATE.equals(action)) {
                getContext().startService(intent);
            } else {
                ContextCompat.startForegroundService(getContext(), intent);
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Ses bildirimi başlatılamadı.");
        }
    }
}
