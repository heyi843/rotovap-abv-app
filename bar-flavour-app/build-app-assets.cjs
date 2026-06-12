const fs = require("node:fs");
const path = require("node:path");
const sharp = require("/Users/heyi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");

const appDir = __dirname;
const sourceMarkdownPath = path.join(appDir, "content.md");
const contentPath = path.join(appDir, "content.js");
const vendorDir = path.join(appDir, "vendor");
const assetsDir = path.join(appDir, "assets");

const markedPath =
  "/Users/heyi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.umd.js";
const lucidePath =
  "/Users/heyi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/lucide/dist/umd/lucide.js";

function copyVendor() {
  fs.mkdirSync(vendorDir, { recursive: true });
  fs.copyFileSync(markedPath, path.join(vendorDir, "marked.umd.js"));
  fs.copyFileSync(lucidePath, path.join(vendorDir, "lucide.js"));
}

function buildContent() {
  const markdown = fs.readFileSync(sourceMarkdownPath, "utf8");
  fs.writeFileSync(
    contentPath,
    `window.DEFAULT_MARKDOWN = ${JSON.stringify(markdown)};\n`
  );
}

async function buildIcons() {
  const svgPath = path.join(assetsDir, "icon.svg");
  const sizes = [
    ["icon-180.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["icon-maskable-512.png", 512]
  ];

  await Promise.all(
    sizes.map(([fileName, size]) =>
      sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(path.join(assetsDir, fileName))
    )
  );
}

async function main() {
  copyVendor();
  buildContent();
  await buildIcons();
  console.log("Built BAR FLAVOUR app assets");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
