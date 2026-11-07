package com.studybutler.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** 手机重启后，把没到期的闹钟重新排上（否则重启就全丢了） */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
                && !"android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            return;
        }

        SharedPreferences sp = ctx.getSharedPreferences("study_butler", Context.MODE_PRIVATE);
        String raw = sp.getString("data", "");
        if (raw.isEmpty()) return;

        try {
            JSONObject root = new JSONObject(raw);
            JSONArray events = root.optJSONArray("events");
            if (events == null) return;

            long now = System.currentTimeMillis();
            MainActivity unused = null;

            for (int i = 0; i < events.length(); i++) {
                JSONObject e = events.getJSONObject(i);
                if (e.optBoolean("done", false)) continue;
                if (!e.has("alarmAt")) continue;
                long at = e.optLong("alarmAt", 0);
                if (at <= now) continue;

                Intent ai = new Intent(ctx, AlarmReceiver.class);
                ai.putExtra("id", e.optString("id"));
                ai.putExtra("title", e.optString("title"));
                ai.putExtra("body", e.optString("note", "该做下一件事了"));

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pi = PendingIntent.getBroadcast(
                        ctx, e.optString("id").hashCode(), ai, flags);

                AlarmManager am = (AlarmManager)
                        ctx.getSystemService(Context.ALARM_SERVICE);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
                }
            }
        } catch (Exception ignored) {}
    }
}
