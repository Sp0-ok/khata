#!/usr/bin/env node
// Generates dist/client/index.html so Capacitor (and any static host) has an
// SPA entry point. TanStack Start's normal build doesn't emit one because it
// renders HTML through SSR at request time — but Capacitor's Android WebView
// needs a real index.html on disk.
//
// We detect the client entry JS by finding the chunk that contains
// `hydrateRoot`, link the single emitted CSS bundle, and ship a minimal
// HTML shell. The TanStack client router then takes over after hydration
// and handles every in-app route (parties, settings, reports, etc.).
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const clientDir = "dist/client";
const assetsDir = join(clientDir, "assets");

if (!existsSync(assetsDir)) {
  console.error(`[postbuild] ${assetsDir} not found — did the build succeed?`);
  process.exit(1);
}

const files = readdirSync(assetsDir);

// Client entry = the JS chunk that calls hydrateRoot.
let entryJs = null;
for (const f of files) {
  if (!f.endsWith(".js")) continue;
  const content = readFileSync(join(assetsDir, f), "utf8");
  if (content.includes("hydrateRoot")) {
    entryJs = f;
    break;
  }
}
if (!entryJs) {
  console.error("[postbuild] Could not locate client entry chunk (no hydrateRoot found).");
  process.exit(1);
}

const cssFile = files.find((f) => f.endsWith(".css")) ?? null;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0d9488" />
    <title>KhataBook</title>
    <meta name="description" content="Local-first bookkeeping for parties, transactions, and balances." />
${cssFile ? `    <link rel="stylesheet" href="/assets/${cssFile}" />\n` : ""}    <script type="module" src="/assets/${entryJs}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), html);
console.log(`[postbuild] Wrote ${clientDir}/index.html (entry: ${entryJs}${cssFile ? `, css: ${cssFile}` : ""})`);
