# Building the KhataBook Android APK

KhataBook is a fully-local web app (data lives in IndexedDB inside the
Android WebView, so it persists across app restarts and device reboots) that
is wrapped into a native Android app with Capacitor.

## Prerequisites (one-time, on your computer)

- **Node.js 20+** and **Bun** (`curl -fsSL https://bun.sh/install | bash`)
- **Java JDK 17** (e.g. Temurin 17)
- **Android Studio** (latest stable) with the Android SDK + an emulator or a
  physical device with USB debugging enabled

## Full build flow — from clone to installed APK

```bash
# 1. Clone & install JS dependencies
git clone <your-repo-url> khatabook
cd khatabook
bun install

# 2. Build the production web bundle (static SPA inside dist/client)
bun run build

# 3. Add the Android platform (only the FIRST time)
bunx cap add android

# 4. Generate the launcher icon + splash from /resources
#    (uses resources/icon.png and resources/splash.png)
bunx capacitor-assets generate --android

# 5. Copy the freshly-built web assets into the native Android project
bunx cap sync android

# 6. Open the project in Android Studio
bunx cap open android
```

In Android Studio:

1. Wait for Gradle sync to finish.
2. Pick a device (emulator or your plugged-in phone) in the toolbar.
3. **Run ▸ Run 'app'** to install + launch a debug build, **or**
4. **Build ▸ Build Bundle(s) / APK(s) ▸ Build APK(s)** to produce a shareable
   APK at `android/app/build/outputs/apk/debug/app-debug.apk`.

For a signed release APK, follow Android Studio's
**Build ▸ Generate Signed Bundle / APK** wizard with your keystore.

## Required Android permissions

KhataBook saves CSV / PDF / JSON-backup exports into the device's
`Downloads/Khata/` folder (with `Documents/Khata/` as a fallback) using the
Capacitor Filesystem plugin.

Add these inside `<manifest>` in
`android/app/src/main/AndroidManifest.xml` **before the first `<application>`
tag** (Capacitor only adds INTERNET by default):

```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="29" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
```

On Android 10+ scoped storage is used automatically — no runtime prompt is
required. Files appear in the user's file manager under
`Internal storage → Download → Khata` (or `Documents → Khata`).

## App icon & splash

- Source images live in `/resources/`:
  - `resources/icon.png` — 1024×1024 launcher icon
  - `resources/splash.png` — 2732×2732 splash background
- Re-running `bunx capacitor-assets generate --android` regenerates every
  density bucket (`mipmap-*`, adaptive icon, splash drawables) from those
  source images. Re-run it any time you change the artwork.

## Updating after code changes

```bash
bun run build
bunx cap sync android
```

Then re-run from Android Studio (or `bunx cap run android`).

## Notes

- All storage is fully offline (Dexie / IndexedDB) and persists between app
  launches and reboots.
- Use **Settings → Export** to back up data to JSON in `Downloads/Khata/`,
  and **Import** to restore.
- Each party supports CSV export / import and a printable PDF statement —
  all saved into the same `Downloads/Khata/` folder on the device.
