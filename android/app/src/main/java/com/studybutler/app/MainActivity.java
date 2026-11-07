package com.studybutler.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

public class MainActivity extends Activity {

    private WebView web;
    private SharedPreferences sp;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        sp = getSharedPreferences("study_butler", Context.MODE_PRIVATE);
        createChannel();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // 让 localStorage 能用
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "Native");

        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    /** 通知渠道：Android 8+ 必须建，否则通知不显示 */
    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            NotificationChannel ch = new NotificationChannel(
                    "study_reminder", "学习提醒", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("日程到点提醒");
            ch.enableVibration(true);
            ch.setShowBadge(true);
            nm.createNotificationChannel(ch);
        }
    }

    /** 给 JS 调用的原生桥 */
    class Bridge {

        /** 保存数据到 App 私有目录（比 localStorage 更可靠，清缓存也不会丢） */
        @JavascriptInterface
        public void save(String json) {
            sp.edit().putString("data", json).apply();
        }

        @JavascriptInterface
        public String load() {
            return sp.getString("data", "");
        }

        /** 设置一个精确闹钟 */
        @JavascriptInterface
        public void scheduleAlarm(String id, String title, String body, long triggerAtMillis) {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            Intent i = new Intent(MainActivity.this, AlarmReceiver.class);
            i.putExtra("id", id);
            i.putExtra("title", title);
            i.putExtra("body", body);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getBroadcast(
                    MainActivity.this, id.hashCode(), i, flags);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                        && !am.canScheduleExactAlarms()) {
                    // 用户没给精确闹钟权限，退回非精确（仍然会响，只是可能有几分钟误差）
                    am.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
                } else {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
                }
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }
        }

        @JavascriptInterface
        public void cancelAlarm(String id) {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            Intent i = new Intent(MainActivity.this, AlarmReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getBroadcast(
                    MainActivity.this, id.hashCode(), i, flags);
            if (pi != null) am.cancel(pi);
        }

        /** 立即弹一条通知，用来测试 */
        @JavascriptInterface
        public void testNotification() {
            MainActivity.this.runOnUiThread(() -> {
                NotificationHelper.show(MainActivity.this,
                        "测试提醒", "如果你看到这条，说明通知是通的 ✓", 1);
                Toast.makeText(MainActivity.this, "已发送测试通知", Toast.LENGTH_SHORT).show();
            });
        }

        /** 请求通知权限（Android 13+） */
        @JavascriptInterface
        public void requestNotifPermission() {
            MainActivity.this.runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1001);
                }
            });
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android-" + Build.VERSION.SDK_INT;
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }
}
