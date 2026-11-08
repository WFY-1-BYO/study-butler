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

        // 到点提醒用"强提醒"：横幅 + 锁屏可见 + 震动
        NotificationHelper.show(ctx, title, body, title.hashCode(), true);

        try {
            android.os.Vibrator v = (android.os.Vibrator)
                    ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(android.os.VibrationEffect.createWaveform(
                            new long[]{0, 400, 200, 400}, -1));
                } else {
                    v.vibrate(new long[]{0, 400, 200, 400}, -1);
                }
            }
        } catch (Exception ignored) {
        }
    }
}

/** 共用的通知发送逻辑 */
class NotificationHelper {

    /** 渠道 id，和 MainActivity.createChannels() 里保持一致 */
    static final String CHANNEL = "study_alarm_v1";

    static void show(Context ctx, String title, String body, int id, boolean strong) {
        NotificationManager nm = (NotificationManager)
                ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open, flags);

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(ctx, CHANNEL);
        } else {
            b = new Notification.Builder(ctx);
        }

        b.setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setShowWhen(true)
                .setWhen(System.currentTimeMillis());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            b.setVisibility(Notification.VISIBILITY_PUBLIC);   // 锁屏上也能看到内容
            b.setCategory(Notification.CATEGORY_ALARM);       // 归类为闹钟类，优先级更高
        }

        if (strong) {
            // 强提醒：锁屏也会亮屏弹出。系统若不允许，仍会退回横幅通知，不会丢失
            b.setPriority(Notification.PRIORITY_MAX);
            b.setDefaults(Notification.DEFAULT_ALL);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                b.setFullScreenIntent(pi, true);
            }
        } else {
            b.setPriority(Notification.PRIORITY_HIGH);
            b.setDefaults(Notification.DEFAULT_ALL);
        }

        try {
            nm.notify(id, b.build());
        } catch (Exception ignored) {
        }
    }
}
