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
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

public class MainActivity extends Activity {

    private static final int REQ_NOTIF = 1001;

    private WebView web;
    private SharedPreferences sp;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        sp = getSharedPreferences("study_butler", Context.MODE_PRIVATE);
        createChannels();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);       // 让界面能显示本机收进来的图片
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "Native");

        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");

        // 启动自检：第一次进入就主动要权限，不依赖用户去点按钮
        ensureNotifPermission();
    }

    /**
     * 通知渠道。
     * 注意：渠道一旦创建，重要性和开关就由用户掌控，代码再改同名渠道是无效的。
     * 所以这里用一个新的渠道 id（study_alarm_v1），绕过用户在旧渠道上做过的错误设置。
     */
    private void createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);

            NotificationChannel high = new NotificationChannel(
                    "study_alarm_v1", "学习提醒", NotificationManager.IMPORTANCE_HIGH);
            high.setDescription("日程到点提醒，会弹出横幅并响铃");
            high.enableVibration(true);
            high.setVibrationPattern(new long[]{0, 300, 200, 300});
            high.setShowBadge(true);
            high.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(high);

            // 保留旧渠道，避免升级后旧闹钟找不到渠道而静默失败
            NotificationChannel old = new NotificationChannel(
                    "study_reminder", "学习提醒（旧）", NotificationManager.IMPORTANCE_HIGH);
            old.setDescription("兼容 v1.0 的旧提醒渠道");
            nm.createNotificationChannel(old);
        }
    }

    private boolean hasNotifPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            return checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    /** 只在第一次自动请求，避免每次启动都打扰 */
    private void ensureNotifPermission() {
        if (hasNotifPermission()) return;
        if (sp.getBoolean("notif_asked", false)) return;
        sp.edit().putBoolean("notif_asked", true).apply();
        requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIF);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIF) {
            boolean ok = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            toast(ok ? "通知已开启 ✓" : "通知没开，到点不会响。点「去开启」手动打开");
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    /** 给 JS 调用的原生桥 */
    class Bridge {

        @JavascriptInterface
        public void save(String json) {
            sp.edit().putString("data", json).apply();
        }

        @JavascriptInterface
        public String load() {
            return sp.getString("data", "");
        }

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
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
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

        /** 立即弹一条通知。没权限就先要权限，并明确告知，不再静默失败 */
        @JavascriptInterface
        public void testNotification() {
            runOnUiThread(() -> {
                if (!hasNotifPermission()) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIF);
                    toast("还没有通知权限，请在弹出的窗口点「允许」");
                    return;
                }
                NotificationHelper.show(MainActivity.this,
                        "测试提醒", "如果你看到这条，说明通知是通的 ✓", 1, false);
                toast("已发送，看屏幕顶部或通知栏");
            });
        }

        @JavascriptInterface
        public void requestNotifPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && !hasNotifPermission()) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIF);
                }
            });
        }

        /** 诊断：把四个关键开关一次报给界面，用户不用猜 */
        @JavascriptInterface
        public String notifStatus() {
            JSONObject o = new JSONObject();
            try {
                o.put("permission", hasNotifPermission());

                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                o.put("enabled", nm.areNotificationsEnabled());

                boolean chOn = true;
                int imp = 0;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel ch = nm.getNotificationChannel("study_alarm_v1");
                    if (ch == null) {
                        chOn = false;
                    } else {
                        imp = ch.getImportance();
                        chOn = imp != NotificationManager.IMPORTANCE_NONE;
                    }
                }
                o.put("channel", chOn);
                o.put("channelImportance", imp);

                boolean batt = true;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                    batt = pm.isIgnoringBatteryOptimizations(getPackageName());
                }
                o.put("battery", batt);

                boolean exact = true;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                    exact = am.canScheduleExactAlarms();
                }
                o.put("exactAlarm", exact);
                o.put("sdk", Build.VERSION.SDK_INT);
            } catch (Exception ignored) {
            }
            return o.toString();
        }

        /** 直接跳到本 App 的通知设置页，省得用户在系统设置里翻 */
        @JavascriptInterface
        public void openNotifSettings() {
            runOnUiThread(() -> {
                try {
                    Intent i;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                        i.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    } else {
                        i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        i.setData(Uri.parse("package:" + getPackageName()));
                    }
                    startActivity(i);
                } catch (Exception e) {
                    toast("打不开，请手动到 设置 → 通知 → 学习管家");
                }
            });
        }

        /** 跳到电池优化列表 */
        @JavascriptInterface
        public void openBatterySettings() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                } catch (Exception e) {
                    toast("打不开，请手动到 设置 → 电池 → 后台耗电管理");
                }
            });
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android-" + Build.VERSION.SDK_INT;
        }

        /** 打开内置浏览器，去网页上"收"资料 */
        @JavascriptInterface
        public void openGrabber(String url) {
            runOnUiThread(() -> {
                Intent i = new Intent(MainActivity.this, GrabActivity.class);
                if (url != null && url.trim().length() > 0) {
                    i.putExtra(GrabActivity.EXTRA_URL, url.trim());
                }
                startActivity(i);
            });
        }

        /** 已收进来的资料列表（按时间倒序） */
        @JavascriptInterface
        public String listGrabbed() {
            org.json.JSONArray arr = new org.json.JSONArray();
            try {
                java.io.File dir = new java.io.File(getFilesDir(), "grabbed");
                java.io.File[] files = dir.listFiles();
                if (files == null) return arr.toString();

                java.util.Arrays.sort(files, (a, b) ->
                        Long.compare(b.lastModified(), a.lastModified()));

                for (java.io.File f : files) {
                    String n = f.getName();
                    if (!n.endsWith(".png") && !n.endsWith(".jpg") && !n.endsWith(".jpeg")) {
                        continue;
                    }
                    JSONObject o = new JSONObject();
                    o.put("file", n);
                    o.put("path", f.getAbsolutePath());
                    o.put("size", f.length());
                    o.put("time", f.lastModified());

                    String base = n.substring(0, n.lastIndexOf('.'));
                    String preview = readHead(new java.io.File(dir, base + ".txt"), 160);
                    o.put("preview", preview);
                    o.put("source", readHead(new java.io.File(dir, base + ".url"), 300)
                            .replace("\n", " ").trim());
                    arr.put(o);
                }
            } catch (Throwable ignored) {
            }
            return arr.toString();
        }

        /** 读一条已收资料的文字层，用来整理成文档 */
        @JavascriptInterface
        public String readGrabbed(String fileName) {
            try {
                java.io.File dir = new java.io.File(getFilesDir(), "grabbed");
                String base = fileName.contains(".")
                        ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
                java.io.File txt = new java.io.File(dir, base + ".txt");
                if (!txt.exists()) return "";
                byte[] buf = new byte[(int) txt.length()];
                java.io.FileInputStream in = new java.io.FileInputStream(txt);
                int len = in.read(buf);
                in.close();
                return len > 0 ? new String(buf, 0, len, "UTF-8") : "";
            } catch (Throwable e) {
                return "";
            }
        }

        /** 删掉一条已收的资料 */
        @JavascriptInterface
        public void deleteGrabbed(String fileName) {
            try {
                java.io.File dir = new java.io.File(getFilesDir(), "grabbed");
                String base = fileName.contains(".")
                        ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
                new java.io.File(dir, base + ".png").delete();
                new java.io.File(dir, base + ".jpg").delete();
                new java.io.File(dir, base + ".txt").delete();
                new java.io.File(dir, base + ".url").delete();
            } catch (Throwable ignored) {
            }
        }
    }

    private static String readHead(java.io.File f, int max) {
        try {
            if (!f.exists()) return "";
            byte[] buf = new byte[3000];
            java.io.FileInputStream in = new java.io.FileInputStream(f);
            int len = in.read(buf);
            in.close();
            if (len <= 0) return "";
            String s = new String(buf, 0, len, "UTF-8");
            int sep = s.indexOf("\n\n");
            if (sep >= 0 && sep < 600) s = s.substring(sep + 2);   // 跳过第一行的来源网址
            s = s.replaceAll("\\s+", " ").trim();
            return s.length() > max ? s.substring(0, max) : s;
        } catch (Throwable e) {
            return "";
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
        if (web != null) {
            web.onResume();
            // 从"收网页"返回后，让界面刷新资料列表
            web.evaluateJavascript("if(window.onGrabbed)onGrabbed()", null);
        }
    }
}
