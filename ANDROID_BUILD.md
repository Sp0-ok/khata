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

## Updating after code changes

```bash
bun run build
bunx cap sync android
```

Then re-build the APK from Android Studio.

## Notes

- Storage is fully offline (Dexie / IndexedDB) and persists between app launches.
- Use **Settings → Export** to back up your data to a JSON file, and **Import** to restore.
- Each party also supports CSV export, CSV import and printable PDF statements.
