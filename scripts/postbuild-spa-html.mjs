#!/usr/bin/env node
// After both Vite builds run, flatten the SPA bundle from dist/client/spa
// into dist/client (overwriting any SSR-only index.html) so Capacitor sees:
//   dist/client/index.html
//   dist/client/assets/spa-*.js
//   dist/client/assets/*.css
// The TanStack SSR worker bundle is unaffected — it lives in dist/server.
import {
  readdirSync, readFileSync, writeFileSync, existsSync,
  mkdirSync, copyFileSync, rmSync,
} from "node:fs";
import { join } from "node:path";

const clientDir = "dist/client";
const spaDir = join(clientDir, "spa");
const spaAssets = join(spaDir, "assets");
const targetAssets = join(clientDir, "assets");

if (!existsSync(spaAssets)) {
  console.error(`[postbuild] ${spaAssets} not found — did vite.spa.config.ts run?`);
  process.exit(1);
}

mkdirSync(targetAssets, { recursive: true });

const files = readdirSync(spaAssets);
let entryJs = null;
let cssFile = null;
for (const f of files) {
  copyFileSync(join(spaAssets, f), join(targetAssets, f));
  if (f.startsWith("spa-") && f.endsWith(".js")) entryJs = f;
  else if (f.endsWith(".css")) cssFile = f;
}

if (!entryJs) {
  console.error("[postbuild] Could not find SPA entry chunk (spa-*.js).");
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0d9488" />
    <title>KhataBook</title>
    <meta name="description" content="Local-first bookkeeping for parties, transactions, and balances." />
${cssFile ? `    <link rel="stylesheet" href="./assets/${cssFile}" />\n` : ""}    <script type="module" src="./assets/${entryJs}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), html);

// Clean up the intermediate spa/ folder so Capacitor doesn't ship duplicates.
rmSync(spaDir, { recursive: true, force: true });

console.log(`[postbuild] Wrote ${clientDir}/index.html (entry: ${entryJs}${cssFile ? `, css: ${cssFile}` : ""})`);
