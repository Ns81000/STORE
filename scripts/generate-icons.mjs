import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve("public");
const svgBg = fs.readFileSync(path.join(publicDir, "store-icon-bg.svg"));
const svgTransparent = fs.readFileSync(path.join(publicDir, "store-icon-transparent.svg"));

async function generate() {
  console.log("Generating all STORE app icons using the current logo...");

  // 1. Vector icons
  fs.writeFileSync(path.join(publicDir, "icon.svg"), svgTransparent);

  // 2. Favicons
  await sharp(svgTransparent).resize(32, 32).png().toFile(path.join(publicDir, "favicon.png"));
  await sharp(svgTransparent).resize(32, 32).png().toFile(path.join(publicDir, "favicon.ico"));

  // 3. PWA Icons (Solid Background for Standalone & Mobile Homescreens)
  await sharp(svgBg).resize(192, 192).png().toFile(path.join(publicDir, "icon-192.png"));
  await sharp(svgBg).resize(512, 512).png().toFile(path.join(publicDir, "icon-512.png"));
  await sharp(svgBg).resize(512, 512).png().toFile(path.join(publicDir, "icon-maskable.png"));
  await sharp(svgBg).resize(180, 180).png().toFile(path.join(publicDir, "apple-touch-icon.png"));

  console.log("✓ Successfully generated all PWA & browser icons with current STORE logo!");
}

generate().catch(console.error);
