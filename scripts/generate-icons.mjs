import sharp from "sharp";
import fs from "fs";

const svgBg = fs.readFileSync("store-icon-bg.svg");
const svgTransparent = fs.readFileSync("store-icon-transparent.svg");

async function generate() {
  // Use transparent for standard browser icons
  fs.writeFileSync("public/icon.svg", svgTransparent);
  await sharp(svgTransparent).resize(32, 32).toFile("public/favicon.png");
  await sharp(svgTransparent).resize(192, 192).toFile("public/icon-192.png");
  await sharp(svgTransparent).resize(512, 512).toFile("public/icon-512.png");

  // Use solid background for Apple Touch and Maskable icons
  await sharp(svgBg).resize(512, 512).toFile("public/icon-maskable.png");
  await sharp(svgBg).resize(180, 180).toFile("public/apple-touch-icon.png");
}

generate()
  .then(() => console.log("Done"))
  .catch(console.error);
