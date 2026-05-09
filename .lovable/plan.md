I’m sorry this has dragged on. I checked the working Flashly repo you linked and the biggest difference is not a magic animation pattern — it’s that Flashly does almost nothing special around keyboard/focus. This Khata app now has several defensive layers that can themselves trigger Android WebView resize/focus cascades.

Plan:

1. Remove the risky Android keyboard workaround layer
- Stop importing/running `installAndroidKeyboardWorkaround()` in the Android SPA entry.
- Remove the `visualViewport`, `focusin/focusout`, `keyboardWillShow`, `keyboardDidShow`, and `Capacitor.addListener` logic from the input path.
- Remove keyboard-open body class mutation as a runtime behavior.

2. Match the working repo’s simpler Capacitor config
- Remove the `@capacitor/keyboard` dependency and plugin config from `capacitor.config.ts`.
- Keep the Android config minimal like the working app.
- Keep the manifest patcher only for main activity `windowSoftInputMode="adjustPan"` and `hardwareAccelerated="true"`, with no JS keyboard plugin dependency.

3. Remove focus-time layout mutations
- Remove CSS rules tied to `body.keyboard-open` / `body.keyboard-focus` that globally mutate animations, transitions, display, or layout during focus.
- Remove `var(--keyboard-height)` padding from `AppShell`.
- Keep only stable, non-reactive CSS: `font-size: 16px`, safe area padding, normal scrolling.

4. Replace the custom modal with a static, Android-safe shell
- Keep the non-Radix `NativeModal`, but make it stable: no focus listeners, no body class toggles, no keyboard-scroll behavior that depends on runtime keyboard state.
- Use a plain full-screen overlay with a centered panel and internal scroll, similar in simplicity to the working repo’s dialog behavior.

5. Undo input over-isolation if it adds stale state complexity
- Replace `LocalInput` / `LocalTextarea` usage back to normal controlled `Input` / `Textarea` where possible.
- Keep text inputs as 16px to avoid Android auto-zoom.
- Avoid `autoFocus` and avoid any `onFocus` / `onBlur` state updates.

6. Disable the always-on debug UI from the normal APK path
- Keep the hidden debug overlay available, but remove the always-on fixed bottom log panel from normal app startup because it is another fixed element updated on every tap/focus.
- Keep persistent logging lightweight and silent unless explicitly opened.

7. Audit and verify
- Search again for focus/keyboard/viewport handlers and remove leftovers from the core input path.
- Run the project’s normal validation command available in the harness after changes.
- Provide exact rebuild steps: `npm install`, `npm run build`, `npx cap sync android`, rebuild APK.

Technical rationale:
- The linked working app has no `@capacitor/keyboard`, no JS keyboard listeners, no `visualViewport` focus handling, no keyboard-height CSS variable, and no global class changes when an input focuses.
- This app’s last logs now show `tap` then `input:focus`, which means the freeze happens immediately after focus handling starts. The safest fix is to remove all JS/CSS that reacts to focus/keyboard opening and let Android handle panning natively.