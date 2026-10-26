package com.BeyTool.app;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Paket indirmeleri için yerel akış.
 * WebView fetch'i GitHub'ın CORS başlıkları yüzünden engellenir; bu eklenti
 * indirmeyi doğrudan yapar, ilerleme bildirir ve gerçekten iptal eder.
 */
@CapacitorPlugin(name = "PackDownloader")
public class PackDownloaderPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile HttpURLConnection active;
    private volatile boolean cancelled;

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String path = call.getString("path");
        if (url == null || path == null || url.isEmpty() || path.isEmpty()) {
            call.reject("Eksik parametre");
            return;
        }
        Context context = getContext();
        cancelled = false;

        executor.execute(() -> {
            File target = new File(context.getFilesDir(), path);
            File parent = target.getParentFile();
            if (parent != null && !parent.exists()) {
                //noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            }
            File temp = new File(target.getAbsolutePath() + ".part");
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                active = connection;
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(60000);
                connection.setRequestProperty("Accept", "application/octet-stream");
                connection.setRequestProperty("User-Agent", "BeyTool");
                int code = connection.getResponseCode();
                if (code < 200 || code >= 300) {
                    throw new HttpStatusException(code);
                }

                long total = connection.getContentLength();
                InputStream input = connection.getInputStream();
                FileOutputStream output = new FileOutputStream(temp);
                byte[] buffer = new byte[64 * 1024];
                long received = 0;
                long lastNotified = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    if (cancelled) throw new CancelledException();
                    output.write(buffer, 0, read);
                    received += read;
                    if (received - lastNotified >= 131072 || (total > 0 && received >= total)) {
                        lastNotified = received;
                        final long sent = received;
                        final long size = total;
                        getBridge().getWebView().post(() -> {
                            JSObject progress = new JSObject();
                            progress.put("received", sent);
                            progress.put("total", size > 0 ? size : 0);
                            notifyListeners("progress", progress);
                        });
                    }
                }
                output.flush();
                output.close();
                input.close();
                if (cancelled) throw new CancelledException();

                if (target.exists() && !target.delete()) {
                    throw new Exception("Mevcut dosya değiştirilemedi");
                }
                if (!temp.renameTo(target)) {
                    throw new Exception("İndirilen dosya taşınamadı");
                }

                JSObject result = new JSObject();
                result.put("path", path);
                getBridge().getWebView().post(() -> call.resolve(result));
            } catch (HttpStatusException failure) {
                //noinspection ResultOfMethodCallIgnored
                temp.delete();
                getBridge().getWebView().post(() -> call.reject("HTTP " + failure.code));
            } catch (CancelledException failure) {
                //noinspection ResultOfMethodCallIgnored
                temp.delete();
                getBridge().getWebView().post(() -> call.reject("İptal edildi"));
            } catch (Exception failure) {
                //noinspection ResultOfMethodCallIgnored
                temp.delete();
                String message = cancelled
                    ? "İptal edildi"
                    : (failure.getMessage() != null ? failure.getMessage() : "İndirme başarısız");
                getBridge().getWebView().post(() -> call.reject(message));
            } finally {
                active = null;
                if (connection != null) connection.disconnect();
            }
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cancelled = true;
        HttpURLConnection connection = active;
        if (connection != null) {
            try {
                connection.disconnect();
            } catch (Exception ignored) {
                // Bağlantı zaten kapanmış olabilir.
            }
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        cancelled = true;
        HttpURLConnection connection = active;
        if (connection != null) {
            try {
                connection.disconnect();
            } catch (Exception ignored) {
                // yoksay
            }
        }
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private static class HttpStatusException extends Exception {
        final int code;

        HttpStatusException(int code) {
            this.code = code;
        }
    }

    private static class CancelledException extends Exception {
    }
}
