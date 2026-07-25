// Copies Chart.js and jsPDF's built UMD bundles from node_modules into
// www/vendor/, so the packaged Android app has them bundled locally and
// works fully offline instead of depending on a CDN (index.html's loader
// tries www/vendor/*.js first, then falls back to CDNs).
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VENDOR_DIR = path.join(ROOT, "www", "vendor");

const FILES = [
  {
    src: path.join(ROOT, "node_modules", "chart.js", "dist", "chart.umd.js"),
    fallbackSrc: path.join(ROOT, "node_modules", "chart.js", "dist", "chart.umd.min.js"),
    dest: path.join(VENDOR_DIR, "chart.umd.min.js")
  },
  {
    src: path.join(ROOT, "node_modules", "jspdf", "dist", "jspdf.umd.min.js"),
    dest: path.join(VENDOR_DIR, "jspdf.umd.min.js")
  }
];

fs.mkdirSync(VENDOR_DIR, { recursive: true });

let ok = true;
for (const file of FILES) {
  const source = fs.existsSync(file.src) ? file.src : file.fallbackSrc;
  if (!source || !fs.existsSync(source)) {
    console.warn(`[prepare-www] Could not find a build for ${path.basename(file.dest)} in node_modules — the app will fall back to loading it from a CDN at runtime.`);
    ok = false;
    continue;
  }
  fs.copyFileSync(source, file.dest);
  console.log(`[prepare-www] Copied ${path.relative(ROOT, source)} -> ${path.relative(ROOT, file.dest)}`);
}

if (!ok) {
  console.warn("[prepare-www] One or more vendor files were not bundled. Run `npm install` first.");
}
