package com.creativebydrshakil.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends AppCompatActivity {

    private static final String HOME_URL = "https://creativebydrshakil.com";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";

    private WebView webView;
    private ProgressBar topProgressBar;
    private FrameLayout fullscreenContainer;
    private View customFullscreenView;
    private WebChromeClient.CustomViewCallback customViewCallback;

    private ValueCallback<Uri[]> fileUploadCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    private boolean isInitialLoadComplete = false;
    private String lastValidUrl = HOME_URL;
    private long lastBackPressTime = 0;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 1. Install Android 12+ Native SplashScreen API (with backward compatibility for Android 7–11)
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        final long startTimestamp = System.currentTimeMillis();
        splashScreen.setKeepOnScreenCondition(() -> {
            long elapsed = System.currentTimeMillis() - startTimestamp;
            return !isInitialLoadComplete && elapsed < 2600;
        });

        super.onCreate(savedInstanceState);

        // 2. Enforce OS-level screenshot & screen-recording protection (FLAG_SECURE)
        Window window = getWindow();
        if (window != null) {
            window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );
            window.setStatusBarColor(Color.parseColor("#0A0A0C"));
            window.setNavigationBarColor(Color.parseColor("#0A0A0C"));
        }

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        topProgressBar = findViewById(R.id.top_progress_bar);
        fullscreenContainer = findViewById(R.id.fullscreen_container);

        // Prevent any white flash before first WebView paint
        webView.setBackgroundColor(Color.parseColor("#0A0A0C"));

        // Register file chooser launcher for student profile photo upload
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (fileUploadCallback == null) return;
                Uri[] results = null;
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    String dataString = result.getData().getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
        );

        configureWebView();
        configureBackNavigation();

        // Load deep-link URL if launched via link, otherwise HOME_URL
        String startUrl = resolveIntentUrl(getIntent());
        loadTargetUrl(startUrl);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String targetUrl = resolveIntentUrl(intent);
        if (targetUrl != null && !targetUrl.isEmpty() && webView != null) {
            loadTargetUrl(targetUrl);
        }
    }

    private String resolveIntentUrl(Intent intent) {
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri data = intent.getData();
            if (data != null && data.getHost() != null && data.getHost().contains("creativebydrshakil.com")) {
                return data.toString();
            }
        }
        return HOME_URL;
    }

    private void loadTargetUrl(String url) {
        if (!isNetworkAvailable()) {
            lastValidUrl = url;
            webView.loadUrl(OFFLINE_URL);
            isInitialLoadComplete = true;
        } else {
            lastValidUrl = url;
            webView.loadUrl(url);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // Preserve native Android Chrome device model & mobile/tablet tokens for device fingerprinting
        String defaultUa = settings.getUserAgentString();
        if (defaultUa != null && !defaultUa.contains("CreativeByDrShakilApp")) {
            // Strip "; wv" token so YouTube & embedded media players treat the WebView as standard Android Chrome
            String cleanedUa = defaultUa.replace("; wv)", ")").replace("Version/4.0 ", "");
            settings.setUserAgentString(cleanedUa + " CreativeByDrShakilApp/1.0.0");
        }

        // Enable persistent first- and third-party cookies for auth sessions & YouTube embeds
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // Attach JavaScript Bridge for offline retry & client-side Blob downloads (e.g. Quiz Marksheet PDFs)
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null) return false;
                Uri uri = request.getUrl();
                if (uri == null) return false;

                // CRITICAL FIX: Only evaluate external app/browser launch for the main frame.
                // Sub-frame navigations (such as YouTube embeds, iframes, player APIs) must be allowed
                // to load naturally inside the WebView without being intercepted or killed.
                if (!request.isForMainFrame()) {
                    return false;
                }

                String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
                String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";

                // Handle non-http schemes (mailto:, tel:, whatsapp:, tg:, intent:)
                if (!scheme.equals("http") && !scheme.equals("https") && !scheme.equals("file")) {
                    try {
                        Intent externalIntent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(externalIntent);
                    } catch (ActivityNotFoundException ignored) {
                    }
                    return true;
                }

                // Keep creativebydrshakil.com inside the app
                if (host.endsWith("creativebydrshakil.com") || scheme.equals("file")) {
                    if (!uri.toString().equals(OFFLINE_URL)) {
                        lastValidUrl = uri.toString();
                    }
                    return false;
                }

                // Open external links (WhatsApp, Telegram, Facebook, external docs) in native external app/browser
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(browserIntent);
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (url != null && !url.equals(OFFLINE_URL)) {
                    lastValidUrl = url;
                }
                if (topProgressBar != null) {
                    topProgressBar.setProgress(10);
                    topProgressBar.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                isInitialLoadComplete = true;
                if (topProgressBar != null) {
                    topProgressBar.setVisibility(View.GONE);
                }
                CookieManager.getInstance().flush();
                injectBlobDownloadHelper(view);
            }

            @Override
            public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
            ) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    isInitialLoadComplete = true;
                    view.loadUrl(OFFLINE_URL);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (topProgressBar != null) {
                    topProgressBar.setProgress(newProgress);
                    if (newProgress >= 100) {
                        topProgressBar.setVisibility(View.GONE);
                    }
                }
                if (newProgress >= 75) {
                    isInitialLoadComplete = true;
                }
            }

            // True Fullscreen Video + Automatic Landscape Rotation (PipraTube Video.js & YouTube Vidstack)
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customFullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customFullscreenView = view;
                customViewCallback = callback;
                fullscreenContainer.addView(
                    customFullscreenView,
                    new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                );
                fullscreenContainer.setVisibility(View.VISIBLE);
                webView.setVisibility(View.GONE);
                setImmersiveFullscreen(true);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            }

            @Override
            public void onHideCustomView() {
                if (customFullscreenView == null) return;
                setImmersiveFullscreen(false);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                fullscreenContainer.removeView(customFullscreenView);
                fullscreenContainer.setVisibility(View.GONE);
                customFullscreenView = null;
                if (customViewCallback != null) {
                    customViewCallback.onCustomViewHidden();
                    customViewCallback = null;
                }
                webView.setVisibility(View.VISIBLE);
            }

            // Native File Picker for Profile Photo Upload
            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;
                try {
                    Intent intent = fileChooserParams.createIntent();
                    fileChooserLauncher.launch(intent);
                } catch (ActivityNotFoundException e) {
                    fileUploadCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Native DownloadListener for Lecture PDFs, Slides & Attachments
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(
                String url,
                String userAgent,
                String contentDisposition,
                String mimeType,
                long contentLength
            ) {
                if (url == null) return;
                if (url.startsWith("blob:")) {
                    // Handled by injected JS blob download interceptor
                    return;
                }
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null) {
                        request.addRequestHeader("Cookie", cookies);
                    }
                    if (userAgent != null) {
                        request.addRequestHeader("User-Agent", userAgent);
                    }
                    request.setTitle(fileName);
                    request.setDescription("Downloading from Creative By Dr. Shakil");
                    request.setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                    );
                    request.setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        fileName
                    );
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);
                        Toast.makeText(
                            MainActivity.this,
                            "Downloading " + fileName + "...",
                            Toast.LENGTH_SHORT
                        ).show();
                    }
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception ignored) {
                    }
                }
            }
        });
    }

    /**
     * Injects a lightweight interceptor so client-generated Blob downloads
     * (like Quiz Marksheet PDFs created with jsPDF) save directly to Android Downloads.
     */
    private void injectBlobDownloadHelper(WebView view) {
        String js = "(function(){" +
            "if(window.__cbdsBlobHooked)return;window.__cbdsBlobHooked=true;" +
            "function handleBlobAnchor(a,e){" +
            "if(!a||!a.href||!a.href.startsWith('blob:'))return false;" +
            "if(e&&e.preventDefault)e.preventDefault();" +
            "var name=a.getAttribute('download')||a.download||'Marksheet.pdf';" +
            "fetch(a.href).then(function(r){return r.blob();}).then(function(b){" +
            "var reader=new FileReader();" +
            "reader.onloadend=function(){" +
            "var base64=reader.result.split(',')[1];" +
            "if(window.AndroidBridge&&window.AndroidBridge.saveBlobFile){" +
            "window.AndroidBridge.saveBlobFile(base64,name,b.type||'application/pdf');" +
            "}" +
            "};" +
            "reader.readAsDataURL(b);" +
            "});" +
            "return true;" +
            "}" +
            "var origClick=HTMLAnchorElement.prototype.click;" +
            "HTMLAnchorElement.prototype.click=function(){" +
            "if(handleBlobAnchor(this,null))return;" +
            "return origClick.apply(this,arguments);" +
            "};" +
            "document.addEventListener('click',function(e){" +
            "var a=e.target&&e.target.closest?e.target.closest('a[download],a[href^=\"blob:\"]'):null;" +
            "handleBlobAnchor(a,e);" +
            "},true);" +
            "})();";
        view.evaluateJavascript(js, null);
    }

    private void setImmersiveFullscreen(boolean fullscreen) {
        Window window = getWindow();
        if (window == null) return;
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (fullscreen) {
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
    }

    private void configureBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // 1. If fullscreen video is active, exit fullscreen first
                if (customFullscreenView != null && webView != null) {
                    WebChromeClient client = (WebChromeClient) webView.getWebChromeClient();
                    if (client != null) {
                        client.onHideCustomView();
                        return;
                    }
                }

                // 2. Navigate back inside WebView history if possible
                if (webView != null && webView.canGoBack()) {
                    String currentUrl = webView.getUrl();
                    if (currentUrl != null && !currentUrl.equals(OFFLINE_URL)) {
                        webView.goBack();
                        return;
                    }
                }

                // 3. Double-press back within 2 seconds to exit app (prevents accidental exit during quiz/lecture)
                long now = System.currentTimeMillis();
                if (now - lastBackPressTime < 2000) {
                    finish();
                } else {
                    lastBackPressTime = now;
                    Toast.makeText(
                        MainActivity.this,
                        "Press back again to exit",
                        Toast.LENGTH_SHORT
                    ).show();
                }
            }
        });
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm =
            (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnected();
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void retryConnection() {
            new Handler(Looper.getMainLooper()).post(() -> {
                if (isNetworkAvailable()) {
                    String target = (lastValidUrl != null && !lastValidUrl.equals(OFFLINE_URL))
                        ? lastValidUrl
                        : HOME_URL;
                    webView.loadUrl(target);
                } else {
                    Toast.makeText(
                        MainActivity.this,
                        "Still offline. Please check your internet connection.",
                        Toast.LENGTH_SHORT
                    ).show();
                }
            });
        }

        @JavascriptInterface
        public void saveBlobFile(String base64Data, String fileName, String mimeType) {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                String safeName = (fileName != null && !fileName.isEmpty()) ? fileName : "Document.pdf";
                String safeMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "application/pdf";

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, safeMime);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(bytes);
                            }
                        }
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS
                    );
                    if (downloadsDir != null && (downloadsDir.exists() || downloadsDir.mkdirs()) && downloadsDir.canWrite()) {
                        File outFile = new File(downloadsDir, safeName);
                        try (FileOutputStream fos = new FileOutputStream(outFile)) {
                            fos.write(bytes);
                        }
                    } else {
                        // Safe fallback for Android 7–9 (API 24–28) when external storage permission is not granted
                        File appDownloads = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        if (appDownloads != null && !appDownloads.exists()) {
                            appDownloads.mkdirs();
                        }
                        File outFile = new File(appDownloads != null ? appDownloads : getFilesDir(), safeName);
                        try (FileOutputStream fos = new FileOutputStream(outFile)) {
                            fos.write(bytes);
                        }
                    }
                }

                new Handler(Looper.getMainLooper()).post(() ->
                    Toast.makeText(
                        MainActivity.this,
                        "Saved to Downloads: " + safeName,
                        Toast.LENGTH_LONG
                    ).show()
                );
            } catch (Exception e) {
                new Handler(Looper.getMainLooper()).post(() ->
                    Toast.makeText(
                        MainActivity.this,
                        "Failed to save file: " + e.getMessage(),
                        Toast.LENGTH_SHORT
                    ).show()
                );
            }
        }
    }
}
