package com.BeyTool.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Dışa aktarılan videoyu sistem galerisine (Movies/BeyTool) kaydeder.
 * Android 10+ MediaStore kullanır; daha eski sürümlerde public Movies
 * klasörüne yazar (WRITE_EXTERNAL_STORAGE izni gerekir).
 */
@CapacitorPlugin(name = "Gallery")
public class GalleryPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String path = call.getString("path");
        String fileName = call.getString("fileName", "BeyTool.mp4");
        String mimeType = call.getString("mimeType", "video/mp4");

        if (path == null || path.isEmpty()) {
            call.reject("Dosya yolu gerekli.");
            return;
        }

        String localPath = path.startsWith("file://") ? path.substring("file://".length()) : path;
        File source = new File(localPath);
        if (!source.exists()) {
            call.reject("Dışa aktarılan dosya bulunamadı.");
            return;
        }

        try {
            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Video.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Video.Media.MIME_TYPE, mimeType);
                values.put(
                    MediaStore.Video.Media.RELATIVE_PATH,
                    Environment.DIRECTORY_MOVIES + "/BeyTool"
                );
                values.put(MediaStore.Video.Media.IS_PENDING, 1);

                ContentResolver resolver = getContext().getContentResolver();
                uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    throw new Exception("Galeri kaydı açılamadı.");
                }

                try (
                    InputStream in = new FileInputStream(source);
                    OutputStream out = resolver.openOutputStream(uri)
                ) {
                    if (out == null) {
                        throw new Exception("Galeri çıktısı açılamadı.");
                    }
                    copy(in, out);
                }

                values.clear();
                values.put(MediaStore.Video.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            } else {
                File dir = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES),
                    "BeyTool"
                );
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new Exception("Galeri klasörü oluşturulamadı.");
                }
                File dest = new File(dir, fileName);
                try (
                    InputStream in = new FileInputStream(source);
                    OutputStream out = new java.io.FileOutputStream(dest)
                ) {
                    copy(in, out);
                }
                uri = Uri.fromFile(dest);
            }

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "Galeriye kaydedilemedi." : error.getMessage());
        }
    }

    private void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) > 0) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }
}
