package com.studybutler.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Picture;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 内置浏览器：用来把网页上"你屏幕上看到的内容"整页收进资料库。
 *
 * 关键点：
 * 1. 用的是你自己在网页上的登录状态（Cookie 存在本机），不是破解；
 * 2. 抓的是"已经渲染出来的画面"，所以不需要知道对方网页结构，改版也不影响；
 * 3. 全程在本机完成，不经过任何服务器。
 */
public class GrabActivity extends Activity {

    public static final String EXTRA_URL = "url";

    private WebView web;
    private EditText addr;
    private ProgressBar bar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        // ===== 顶部地址栏 =====
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setBackgroundColor(0xFF1A1D24);
        top.setPadding(12, 10, 12, 10);

        addr = new EditText(this);
        addr.setSingleLine(true);
        addr.setTextColor(0xFFFFFFFF);
        addr.setHintTextColor(0xFF888888);
        addr.setHint("输入网址，例如 zxxk.com");
        addr.setTextSize(14);
        addr.setBackgroundColor(0xFF2A2F3A);
        addr.setPadding(20, 14, 20, 14);
        LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        top.addView(addr, alp);

        Button go = new Button(this);
        go.setText("打开");
        go.setTextSize(13);
        go.setBackgroundColor(0xFF4F8CFF);
        go.setTextColor(0xFFFFFFFF);
        LinearLayout.LayoutParams glp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        glp.leftMargin = 10;
        top.addView(go, glp);
        root.addView(top);

        // ===== 进度条 =====
        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setVisibility(View.GONE);
        root.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 6));

        // ===== 网页 + 悬浮按钮 =====
        FrameLayout stage = new FrameLayout(this);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        // 让 Cookie（登录状态）持久保存，下次进来还是登录态
        android.webkit.CookieManager cm = android.webkit.CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                v.loadUrl(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                if (TextUtils.isEmpty(addr.getText())) addr.setText(url);
                bar.setVisibility(View.GONE);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) {
                bar.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
                bar.setProgress(p);
            }
        });

        stage.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        Button capture = new Button(this);
        capture.setText("收进来");
        capture.setTextSize(15);
        capture.setTextColor(0xFFFFFFFF);
        capture.setBackgroundColor(0xFF22C55E);
        FrameLayout.LayoutParams clp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        clp.gravity = Gravity.BOTTOM | Gravity.END;
        clp.setMargins(0, 0, 36, 48);
        stage.addView(capture, clp);

        root.addView(stage, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);

        String start = getIntent().getStringExtra(EXTRA_URL);
        if (TextUtils.isEmpty(start)) start = "https://www.zxxk.com";
        addr.setText(start);
        web.loadUrl(start);

        go.setOnClickListener(v -> {
            String u = addr.getText().toString().trim();
            if (u.isEmpty()) return;
            if (!u.startsWith("http")) u = "https://" + u;
            web.loadUrl(u);
        });

        capture.setOnClickListener(v -> doCapture());
    }

    /** 抓当前整页：先取文字，再截图，一起存进资料库 */
    private void doCapture() {
        Toast.makeText(this, "正在收…", Toast.LENGTH_SHORT).show();

        // 取「标题 + 正文」，不再拿整页 innerText：
        // 整页 innerText 开头是导航栏，资料库标题会变成一坨导航词
        String js =
                "(function(){try{" +
                "var title='';" +
                "var h1=document.querySelector('h1');" +
                "if(h1&&h1.innerText&&h1.innerText.trim().length>2){title=h1.innerText.trim();}" +
                "if(!title){" +
                "  var t=document.title||'';" +
                "  var parts=t.split(/[-_|—｜]/);" +
                "  for(var i=0;i<parts.length;i++){" +
                "    var p=parts[i].trim();" +
                "    if(p.length>4&&!/学科网|zxxk/i.test(p)){title=p;break;}" +
                "  }" +
                "}" +
                "var best='',bestScore=0;" +
                "var cand=['article','main','#content','.content','.detail','.detail-content','.article-content','.text','.con','.main'];"
                +
                "for(var ci=0;ci<cand.length;ci++){" +
                "  var els=document.querySelectorAll(cand[ci]);" +
                "  for(var ei=0;ei<els.length;ei++){" +
                "    var el=els[ei];" +
                "    var txt=(el.innerText||'').trim();" +
                "    if(txt.length<200) continue;" +
                "    var aLen=0,as=el.querySelectorAll('a');" +
                "    for(var ai=0;ai<as.length;ai++){aLen+=(as[ai].innerText||'').length;}" +
                "    var score=txt.length-2*aLen;" +   // 链接越多越不像正文
                "    if(score>bestScore){bestScore=score;best=txt;}" +
                "  }" +
                "}" +
                "var body=best||(document.body.innerText||'');" +
                "return JSON.stringify({title:title,text:body.slice(0,60000)});" +
                "}catch(e){return JSON.stringify({title:'',text:''})}})()";

        web.evaluateJavascript(js, outer -> {
            String title = "";
            String text = "";
            try {
                String inner = new org.json.JSONTokener(outer).nextValue().toString();
                org.json.JSONObject o = new org.json.JSONObject(inner);
                title = o.optString("title", "");
                text = o.optString("text", "");
            } catch (Exception ignored) {
            }
            shoot(title, text);
        });
    }

    private void shoot(String title, String text) {
        // capturePicture 需要软件层渲染，否则拿到空白
        web.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        web.postDelayed(() -> {
            Bitmap bmp = null;
            try {
                Picture pic = web.capturePicture();
                if (pic != null && pic.getWidth() > 0 && pic.getHeight() > 0) {
                    int w = pic.getWidth();
                    int h = Math.min(pic.getHeight(), 14000);   // 防止超大图 OOM
                    bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                    Canvas c = new Canvas(bmp);
                    c.drawColor(Color.WHITE);
                    c.clipRect(0, 0, w, h);
                    pic.draw(c);
                }
            } catch (Throwable ignored) {
            }

            // 降级：只截可见区域
            if (bmp == null) {
                try {
                    bmp = Bitmap.createBitmap(
                            Math.max(1, web.getWidth()),
                            Math.max(1, web.getHeight()),
                            Bitmap.Config.ARGB_8888);
                    Canvas c = new Canvas(bmp);
                    c.drawColor(Color.WHITE);
                    web.draw(c);
                } catch (Throwable t) {
                    bmp = null;
                }
            }

            if (bmp == null) {
                Toast.makeText(this, "这页截不下来，试试往上滚一点再收", Toast.LENGTH_LONG).show();
                return;
            }

            save(bmp, title, text);
        }, 400);
    }

    private void save(Bitmap bmp, String title, String text) {
        try {
            File dir = new File(getFilesDir(), "grabbed");
            if (!dir.exists()) dir.mkdirs();

            String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.CHINA)
                    .format(new Date());
            String base = "grab_" + stamp;

            File png = new File(dir, base + ".png");
            FileOutputStream fos = new FileOutputStream(png);
            bmp.compress(Bitmap.CompressFormat.JPEG, 82, fos);   // 用 JPEG 编码省空间
            fos.close();

            File txt = new File(dir, base + ".txt");
            FileOutputStream tf = new FileOutputStream(txt);
            String head = web.getUrl() + "\n";
            if (title != null && title.trim().length() > 0) {
                head += "#TITLE#" + title.trim().replace("\n", " ") + "\n";
            }
            head += "\n";
            tf.write((head + (text == null ? "" : text)).getBytes("UTF-8"));
            tf.close();

            // 记录来源网址，方便回溯
            File src = new File(dir, base + ".url");
            FileOutputStream sf = new FileOutputStream(src);
            sf.write(web.getUrl().getBytes("UTF-8"));
            sf.close();

            bmp.recycle();

            Toast.makeText(this, "已收进资料库 ✓ 共 " + (png.length() / 1024) + " KB",
                    Toast.LENGTH_SHORT).show();
            setResult(RESULT_OK, new Intent());
            finish();
        } catch (Throwable e) {
            Toast.makeText(this, "保存失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.setLayerType(View.LAYER_TYPE_NONE, null);
            web.destroy();
        }
        super.onDestroy();
    }
}
