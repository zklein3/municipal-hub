package com.fireops7.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  // Default Android back button finishes the activity (exits the app) since
  // BridgeActivity doesn't navigate WebView history on its own. Go back through
  // the WebView's own history first — matches the in-browser back button behavior.
  @Override
  public void onBackPressed() {
    if (this.bridge.getWebView().canGoBack()) {
      this.bridge.getWebView().goBack();
    } else {
      super.onBackPressed();
    }
  }
}
