#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const softInputMode = process.env.ANDROID_SOFT_INPUT_MODE || "adjustPan";

if (!existsSync(manifestPath)) {
  console.log("[android-keyboard] Android project not present; skipping manifest patch.");
  process.exit(0);
}

let xml = readFileSync(manifestPath, "utf8");
const before = xml;

function setAttr(tag, attr, value) {
  const attrPattern = new RegExp(`\\s${attr}="[^"]*"`);
  if (attrPattern.test(tag)) return tag.replace(attrPattern, ` ${attr}="${value}"`);
  return tag.replace(/>$/, ` ${attr}="${value}">`);
}

xml = xml.replace(/<application\b[^>]*>/, (tag) =>
  setAttr(tag, "android:hardwareAccelerated", "true"),
);

xml = xml.replace(/<activity\b(?=[^>]*android:name="[^"]*MainActivity")[^>]*>/, (tag) =>
  setAttr(tag, "android:windowSoftInputMode", softInputMode),
);

if (xml !== before) {
  writeFileSync(manifestPath, xml);
  console.log(`[android-keyboard] Patched ${manifestPath}: hardwareAccelerated=true, windowSoftInputMode=${softInputMode}`);
} else {
  console.log(`[android-keyboard] Manifest already patched: windowSoftInputMode=${softInputMode}`);
}