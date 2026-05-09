# Building the Android APK

This is a fully local web app (data stored in IndexedDB) that you wrap into a native Android APK using Capacitor. The IndexedDB persists in the Android WebView's data directory and survives app restarts and reboots.

## One-time setup (on your computer)

You need:
- Node.js / Bun
- Android Studio (with Android SDK + a device or emulator)
- Java JDK 17+

```bash
# 1. Install dependencies
bun install

# 2. Build the web app (static SPA output)
bun run build

# 3. Add the Android platform (only the first time)
bunx cap add android

# 4. Copy the built web assets into the Android project
bunx cap sync android

# 5. Open the project in Android Studio
bunx cap open android
```

In Android Studio:
- Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
- The signed APK appears under `android/app/build/outputs/apk/`.

## Required Android permissions

Exports (CSV, PDF, JSON backup) save to the phone's `Downloads/Khata/` folder
(or `Documents/Khata/` as a fallback) using the Capacitor Filesystem plugin.
Add the following inside `<manifest>` in `android/app/src/main/AndroidManifest.xml`
**before the first `<application>` tag**:

```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="29" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
```

On Android 10+ the Capacitor Filesystem plugin uses scoped storage and writes
to your app's own external Documents/Downloads folder, so no runtime prompt
is required. Files are still visible to the user from their file manager
under `Internal storage → Download → Khata` (or `Documents → Khata`).

## Updating after code changes

```bash
bun run build
bunx cap sync android
```

Then re-build the APK from Android Studio.

## Notes

- Storage is fully offline (Dexie / IndexedDB) and persists between app launches.
- Use **Settings → Export** to back up your data to a JSON file in `Downloads/Khata/`,
  and **Import** to restore.
- Each party also supports CSV export, CSV import and printable PDF statements,
  all saved to the same `Downloads/Khata/` folder on the device.
