package com.BeyTool.app;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import android.os.StatFs;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Tanılama ekranı için cihaz depolama ve bellek bilgisi.
 * Değerler bayt cinsindendir; JavaScript tarafı biçimlendirir.
 */
@CapacitorPlugin(name = "DeviceDiagnostics")
public class DeviceDiagnosticsPlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        JSObject result = new JSObject();
        try {
            File dir = getContext().getFilesDir();
            StatFs stat = new StatFs(dir.getAbsolutePath());
            result.put("freeBytes", (double) stat.getAvailableBytes());
            result.put("totalBytes", (double) stat.getTotalBytes());
        } catch (Exception error) {
            result.put("storageError", String.valueOf(error.getMessage()));
        }

        try {
            ActivityManager manager =
                (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            if (manager != null) {
                ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
                manager.getMemoryInfo(memory);
                result.put("memoryFreeBytes", (double) memory.availMem);
                result.put("memoryTotalBytes", (double) memory.totalMem);
                result.put("lowMemory", memory.lowMemory);
            }
        } catch (Exception error) {
            result.put("memoryError", String.valueOf(error.getMessage()));
        }

        result.put("sdk", Build.VERSION.SDK_INT);
        result.put("device", Build.MANUFACTURER + " " + Build.MODEL);
        result.put("android", Build.VERSION.RELEASE);
        call.resolve(result);
    }
}
