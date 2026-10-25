package com.medya.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

/**
 * Ses WebView'da çalarken süreci canlı tutar; kilit ekranı ve bildirimden
 * oynat/duraklat/ileri/geri kontrolleri sunar. Eylemler JS'e iletilir.
 */
public class AudioNotificationService extends Service {

    static final String ACTION_START = "com.medya.app.audio.START";
    static final String ACTION_UPDATE = "com.medya.app.audio.UPDATE";
    static final String ACTION_STOP = "com.medya.app.audio.STOP";
    static final String ACTION_PLAY = "com.medya.app.audio.PLAY";
    static final String ACTION_PAUSE = "com.medya.app.audio.PAUSE";
    static final String ACTION_NEXT = "com.medya.app.audio.NEXT";
    static final String ACTION_PREVIOUS = "com.medya.app.audio.PREVIOUS";

    private static final String CHANNEL_ID = "medya_audio";
    private static final int NOTIFICATION_ID = 41;

    interface ActionListener {
        void onAction(String action, long positionMs);
    }

    private static ActionListener actionListener;

    static void setActionListener(ActionListener listener) {
        actionListener = listener;
    }

    private MediaSessionCompat session;
    private boolean playing = false;
    private String title = "BeyTool";
    private long durationMs = 0;
    private long positionMs = 0;
    private Bitmap largeIcon;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        largeIcon = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
        session = new MediaSessionCompat(this, "BeyToolAudio");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                playing = true;
                emit("play");
                refresh();
            }

            @Override
            public void onPause() {
                playing = false;
                emit("pause");
                refresh();
            }

            @Override
            public void onSkipToNext() {
                emit("next");
            }

            @Override
            public void onSkipToPrevious() {
                emit("previous");
            }

            @Override
            public void onSeekTo(long pos) {
                positionMs = Math.max(0, pos);
                emit("seek", positionMs);
                refresh();
            }
        });
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String action = intent.getAction();

        if (ACTION_STOP.equals(action)) {
            shutdown();
            return START_NOT_STICKY;
        }

        if (ACTION_PLAY.equals(action)) {
            playing = true;
            emit("play");
        } else if (ACTION_PAUSE.equals(action)) {
            playing = false;
            emit("pause");
        } else if (ACTION_NEXT.equals(action)) {
            emit("next");
        } else if (ACTION_PREVIOUS.equals(action)) {
            emit("previous");
        } else {
            // START / UPDATE: JS'ten gelen gerçek durum
            title = intent.getStringExtra("title");
            if (title == null || title.isEmpty()) title = "BeyTool";
            durationMs = intent.getLongExtra("duration", durationMs);
            positionMs = intent.getLongExtra("position", positionMs);
            playing = intent.getBooleanExtra("playing", playing);
        }

        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        updateSession();
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        shutdown();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void refresh() {
        Notification notification = buildNotification();
        try {
            NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification);
        } catch (SecurityException ignored) {
            // Bildirim izni yoksa sessizce devam et.
        }
        updateSession();
    }

    private void shutdown() {
        try {
            NotificationManagerCompat.from(this).cancel(NOTIFICATION_ID);
        } catch (Exception ignored) {
            // yoksay
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private void emit(String action) {
        emit(action, positionMs);
    }

    private void emit(String action, long position) {
        ActionListener listener = actionListener;
        if (listener != null) {
            listener.onAction(action, position);
        }
    }

    private void updateSession() {
        if (session == null) return;

        MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "BeyTool")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
            .build();
        session.setMetadata(metadata);

        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_SEEK_TO;

        PlaybackStateCompat state = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(
                playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                positionMs,
                playing ? 1f : 0f,
                SystemClock.elapsedRealtime()
            )
            .build();
        session.setPlaybackState(state);
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            pendingFlags()
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_medya)
            .setContentTitle(title)
            .setContentText("BeyTool")
            .setContentIntent(contentIntent)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setLargeIcon(largeIcon)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setStyle(
                new MediaStyle()
                    .setMediaSession(session.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .addAction(android.R.drawable.ic_media_previous, "Önceki", actionIntent(ACTION_PREVIOUS))
            .addAction(
                playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                playing ? "Duraklat" : "Oynat",
                actionIntent(playing ? ACTION_PAUSE : ACTION_PLAY)
            )
            .addAction(android.R.drawable.ic_media_next, "Sonraki", actionIntent(ACTION_NEXT));

        return builder.build();
    }

    private PendingIntent actionIntent(String action) {
        Intent intent = new Intent(this, AudioNotificationService.class);
        intent.setAction(action);
        return PendingIntent.getService(this, action.hashCode(), intent, pendingFlags());
    }

    private int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Ses oynatma",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Arka planda ses ve medya kontrolleri");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }
}
