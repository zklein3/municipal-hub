# FireOps7 — Native App (Capacitor)

## Architecture
This is a **hybrid app** — not fully native. It is a WebView wrapper around `https://www.fireops7.com`. The app installs like a native app on Android/iOS but runs the existing Next.js web app inside a WebView. All data writes go through the same Supabase database as the website.

## Stack
- **Capacitor 8.4.0** — bridges web app to native Android/iOS shell
- **App ID:** `com.fireops7.app`
- **App Name:** FireOps7
- **Server URL:** `https://www.fireops7.com` (live production — WebView loads this)
- **Config file:** `capacitor.config.ts`

---

## Android

### Setup (completed 2026-06-08)
- `@capacitor/android` installed
- `android/` folder scaffolded via `npx cap add android`
- `ANDROID_HOME` set to `C:\Users\zklein3\AppData\Local\Android\Sdk`
- Android Studio installed via winget
- Debug APK built and tested — confirmed writing to production Supabase DB

### Build Workflow
```bash
# After any native config changes (icon, splash, plugins):
npx cap sync android       # push web assets + config to android folder
# Then in Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
```

### Day-to-Day Dev (no APK rebuild needed)
Since the app loads a remote URL, code/UI changes go live automatically:
1. Make changes in Claude Code
2. Push to git → Vercel auto-deploys (~1 min)
3. Close and reopen the app on the phone — changes are live

### When You Need a New APK
- App icon or splash screen changes
- Native plugin additions (camera, push notifications, GPS)
- App name or ID changes
- Play Store submission

### APK Location (debug)
```
android\app\build\outputs\apk\debug\app-debug.apk
```

### Proguard Fix Applied
Changed `proguard-android.txt` → `proguard-android-optimize.txt` in `android/app/build.gradle` (required by Gradle 8+).

---

## iOS (Pending)

### Requirements
- **Mac required** — Xcode only runs on macOS
- **Apple Developer Account** — $99/year (required to sign and install on any device)
- `@capacitor/ios` is already listed as a dependency — code is ready

### Planned Approach: GitHub Actions (cloud Mac)
Build iOS IPA via GitHub Actions macOS runners without needing a local Mac.

**Steps when ready:**
1. Get Apple Developer account
2. Generate signing certificate + provisioning profile in Apple Developer portal
3. Store certificate + profile as GitHub Secrets
4. Add `@capacitor/ios` and scaffold `ios/` folder:
   ```bash
   npm install @capacitor/ios
   npx cap add ios
   npx cap sync ios
   ```
5. Create `.github/workflows/ios-build.yml` — macOS runner, CocoaPods, xcodebuild, sign + export IPA
6. Push to main → IPA built automatically

### GitHub Actions Notes
- Free tier: ~200 effective macOS minutes/month (macOS runners use 10x minute multiplier)
- No local Mac needed — entire build runs in the cloud
- Same git repo already in use — no new infrastructure needed

---

## PWA (Progressive Web App)

Built 2026-06-06 as a fast win before the Capacitor native app. Members get a home screen icon and full-screen launch without an app store.

**Files:**
- `public/manifest.json` — app manifest (name, icons, start URL, display mode)
- `public/sw.js` — service worker (basic caching)
- `components/PWAInstallButton.tsx` — "Install App" button in sidebar; listens for Chrome's `beforeinstallprompt` event, invisible until Chrome signals the site is installable
- Root layout registers the service worker via inline script

**Key fix:** `manifest.json` uses `start_url: "/"` not `"/dashboard"` — dashboard redirects unauthenticated users which blocks Chrome's installability check.

**Icons:** `public/icon-192.png`, `public/icon-512.png`, `public/apple-icon.png`

PWA and Capacitor coexist — PWA handles web/desktop installs, Capacitor handles app store distribution.

---

## App Store Costs
- **Google Play Store** — $25 one-time registration fee
- **Apple App Store** — $99/year Apple Developer account

---

## www/ Folder
A minimal `www/index.html` is required for `npx cap sync` to run (Capacitor needs it even when using a remote server URL). It is **not** committed to git (listed in `.gitignore`) and not served to users — the live URL takes precedence at runtime.

To regenerate after a fresh clone:
```bash
mkdir www
echo '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>' > www/index.html
npx cap sync android
```
