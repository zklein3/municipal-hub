import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.fireops7.app',
  appName: 'FireOps7',
  // Points at the live production URL — Capacitor loads the web app in a WebView
  // Change to a local dev server URL during native development
  server: {
    url: 'https://www.fireops7.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#18181b',
  },
}

export default config
