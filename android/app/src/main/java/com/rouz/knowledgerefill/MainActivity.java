
package com.rouz.knowledgerefill;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    android.util.Log.e("KR_INSETS", "MainActivity onCreate fired");

    // Force the app to fit within system windows (prevents drawing under status/navigation bars)
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

    // Android 15+ (targetSdk 35+) enables edge-to-edge by default.
    // Apply system bar insets (status/navigation bars) as padding to the WebView
    // so the web UI doesn't render underneath system UI.
    final View webView = this.getBridge().getWebView();

    ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
      Insets sysBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
      android.util.Log.e("KR_INSETS", "systemBars insets=" + sysBars.left + "," + sysBars.top + "," + sysBars.right + "," + sysBars.bottom);
      v.setPadding(sysBars.left, sysBars.top, sysBars.right, sysBars.bottom);
      return insets;
    });

    // Trigger inset dispatch after the view is attached
    webView.post(() -> ViewCompat.requestApplyInsets(webView));
  }
}
