package com.rouz.knowledgerefill;

import android.os.Bundle;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends BridgeActivity {
  private int lastInsetLeft = 0;
  private int lastInsetTop = 0;
  private int lastInsetRight = 0;
  private int lastInsetBottom = 0;
  private boolean pageLoaded = false;

  private void injectSafeAreaCssVars(WebView webView) {
    if (!pageLoaded) return;
    final String js =
        "try{" +
        "document.documentElement.style.setProperty('--safe-top','" + lastInsetTop + "px');" +
        "document.documentElement.style.setProperty('--safe-bottom','" + lastInsetBottom + "px');" +
        "document.documentElement.style.setProperty('--safe-left','" + lastInsetLeft + "px');" +
        "document.documentElement.style.setProperty('--safe-right','" + lastInsetRight + "px');" +
        "}catch(e){}";
    webView.evaluateJavascript(js, null);
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    android.util.Log.e("KR_INSETS", "MainActivity onCreate fired");

    // Force the app to fit within system windows (prevents drawing under status/navigation bars)
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

    // Android 15+ (targetSdk 35+) enables edge-to-edge by default.
    // Apply system bar insets (status/navigation bars) as padding to the WebView
    // so the web UI doesn't render underneath system UI.
    final WebView webView = (WebView) this.getBridge().getWebView();

    webView.setWebViewClient(new WebViewClient() {
      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        pageLoaded = true;
        injectSafeAreaCssVars(view);
      }
    });

    ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
      Insets sysBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
      android.util.Log.e(
          "KR_INSETS",
          "systemBars insets=" + sysBars.left + "," + sysBars.top + "," + sysBars.right + "," + sysBars.bottom);

      lastInsetLeft = sysBars.left;
      lastInsetTop = sysBars.top;
      lastInsetRight = sysBars.right;
      lastInsetBottom = sysBars.bottom;

      // Do NOT apply native padding to the WebView.
      // We inject CSS vars (--safe-*) and let the web UI handle layout offsets.

      // Also inject CSS vars (works reliably once the page is loaded)
      injectSafeAreaCssVars(webView);

      return insets;
    });

    // Trigger inset dispatch after the view is attached
    webView.post(() -> ViewCompat.requestApplyInsets(webView));
  }
}
