import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
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
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

export type SavePayload =
  | { kind: "text"; data: string; mime: string }
  | { kind: "binary"; data: ArrayBuffer; mime: string };

/**
 * Saves a file using modern, scoped-storage-friendly APIs.
 *
 * Strategy on Android (works on Android 10–14+ with no legacy storage perms):
 *   1. Write the file into the app's own external Documents/Khata folder
 *      (Directory.ExternalStorage maps to app-scoped storage on Capacitor 8+
 *      — no WRITE_EXTERNAL_STORAGE permission needed on any modern Android).
 *   2. Open the system Share sheet with the resulting content:// URI so the
 *      user can save to Downloads / Drive / any provider via the SAF picker.
 *
 * On the web preview, falls back to a regular browser download.
 */
export async function saveToKhataFolder(filename: string, payload: SavePayload) {
  // Web preview / non-native -> regular download
  if (!Capacitor.isNativePlatform()) {
    const blob = new Blob([payload.data], { type: payload.mime });
    browserDownload(filename, blob);
    toast.success(`Saved ${filename}`);
    return;
  }

  const writeData =
    payload.kind === "text" ? payload.data : arrayBufferToBase64(payload.data);
  const encoding = payload.kind === "text" ? Encoding.UTF8 : undefined;

  // Scoped, no-permission destinations in priority order.
  const attempts: Array<{ dir: Directory; sub: string; label: string }> = [
    { dir: Directory.Documents, sub: `Khata/${filename}`, label: "Documents/Khata" },
    { dir: Directory.External, sub: `Khata/${filename}`, label: "App files/Khata" },
    { dir: Directory.Data, sub: `Khata/${filename}`, label: "App storage/Khata" },
  ];

  let lastErr: unknown;
  for (const a of attempts) {
    try {
      const res = await Filesystem.writeFile({
        path: a.sub,
        data: writeData,
        directory: a.dir,
        encoding,
        recursive: true,
      });

      // Offer the system share sheet so the user can route the file into
      // Downloads / Drive / email via the Storage Access Framework.
      try {
        const canShare = await Share.canShare();
        if (canShare.value) {
          await Share.share({
            title: filename,
            text: `Save or share ${filename}`,
            url: res.uri,
            dialogTitle: "Save to…",
          });
          toast.success("File ready", { description: filename });
          return res;
        }
      } catch {
        // User dismissed share sheet — file is still saved locally.
      }

      toast.success(`Saved to ${a.label}`, { description: filename });
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  console.error("saveToKhataFolder failed", lastErr);
  toast.error("Couldn't save file", {
    description: String((lastErr as { message?: string })?.message ?? lastErr),
  });
  throw lastErr;
}
