package com.studybutler.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** 到点时被系统叫醒，弹出通知 */
public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        if (title == null) title = "学习提醒";
        if (body == null) body = "该做下一件事了";

        NotificationHelper.show(ctx, title, body, title.hashCode());

        // 震动
        try {
            android.os.Vibrator v = (android.os.Vibrator)
                    ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(android.os.VibrationEffect.createOneShot(
                            400, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(400);
                }
            }
        } catch (Exception ignored) {}
    }
}

/** 共用的通知发送逻辑 */
class NotificationHelper {
    static void show(Context ctx, String title, String body, int id) {
        NotificationManager nm = (NotificationManager)
                ctx.getSystemService(Context.NOTIFICATION_SERVICE);

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open, flags);

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(ctx, "study_reminder");
        } else {
            b = new Notification.Builder(ctx);
        }

        b.setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setPriority(Notification.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_ALL)
                .setContentIntent(pi)
                .setAutoCancel(true);

        nm.notify(id, b.build());
    }
}
