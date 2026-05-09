import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { toast } from "sonner";

function browserDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export type SavePayload =
  | { kind: "text"; data: string; mime: string }
  | { kind: "binary"; data: ArrayBuffer; mime: string };

/**
 * Saves a file to "Downloads/Khata" on Android (or Documents/Khata as a
 * fallback) when running inside the Capacitor APK; falls back to a normal
 * browser download in the web preview.
 */
export async function saveToKhataFolder(filename: string, payload: SavePayload) {
  // Web preview / non-native -> regular download
  if (!Capacitor.isNativePlatform()) {
    const blob =
      payload.kind === "text"
        ? new Blob([payload.data], { type: payload.mime })
        : new Blob([payload.data], { type: payload.mime });
    browserDownload(filename, blob);
    toast.success(`Saved ${filename}`);
    return;
  }

  const writeData =
    payload.kind === "text" ? payload.data : arrayBufferToBase64(payload.data);
  const encoding = payload.kind === "text" ? Encoding.UTF8 : undefined;

  // Try Downloads/Khata first (public, user-visible)
  const attempts: Array<{ dir: Directory; sub: string; label: string }> = [
    { dir: Directory.ExternalStorage, sub: `Download/Khata/${filename}`, label: "Downloads/Khata" },
    { dir: Directory.Documents, sub: `Khata/${filename}`, label: "Documents/Khata" },
    { dir: Directory.Data, sub: `Khata/${filename}`, label: "App storage/Khata" },
  ];

  let lastErr: any;
  for (const a of attempts) {
    try {
      const res = await Filesystem.writeFile({
        path: a.sub,
        data: writeData,
        directory: a.dir,
        encoding,
        recursive: true,
      });
      toast.success(`Saved to ${a.label}`, { description: filename });
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  console.error("saveToKhataFolder failed", lastErr);
  toast.error("Couldn't save file", { description: String(lastErr?.message ?? lastErr) });
  throw lastErr;
}
