import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const publicDir = path.resolve(process.cwd(), "public");

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="128" fill="#07080a"/>
  <rect x="24" y="24" width="464" height="464" rx="104" fill="#101111" stroke="#242728" stroke-width="4"/>
  <defs>
    <linearGradient id="coralGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff7b7b"/>
      <stop offset="100%" stop-color="#ff4444"/>
    </linearGradient>
  </defs>
  <!-- STORE Vault Mark -->
  <rect x="136" y="136" width="240" height="240" rx="48" fill="url(#coralGlow)"/>
  <rect x="180" y="180" width="152" height="152" rx="30" fill="#07080a"/>
  <circle cx="256" cy="256" r="32" fill="url(#coralGlow)"/>
  <path d="M256 200 L256 220 M256 292 L256 312 M200 256 L220 256 M292 256 L312 256" stroke="url(#coralGlow)" stroke-width="12" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, "icon.svg"), svgContent);
console.log("Saved icon.svg");

// Helper to create pure RGBA PNG buffer
function createPng(width, height, r, g, b, a) {
  // Simple uncompressed/deflated raw RGBA PNG
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel + 1;
  const rawData = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * bytesPerPixel;
      // Background #07080a
      let pr = 7,
        pg = 8,
        pb = 10,
        pa = 255;

      // Center icon vault bounding box (relative)
      const nx = x / width;
      const ny = y / height;
      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Outer coral square
      if (Math.abs(dx) <= 0.23 && Math.abs(dy) <= 0.23) {
        pr = 255;
        pg = 97;
        pb = 97;
      }
      // Inner dark square
      if (Math.abs(dx) <= 0.15 && Math.abs(dy) <= 0.15) {
        pr = 13;
        pg = 14;
        pb = 15;
      }
      // Center coral circle
      if (dist <= 0.07) {
        pr = 255;
        pg = 97;
        pb = 97;
      }
      // Center inner crosshair
      if (
        (Math.abs(dx) <= 0.015 && Math.abs(dy) <= 0.12) ||
        (Math.abs(dy) <= 0.015 && Math.abs(dx) <= 0.12)
      ) {
        if (dist >= 0.07 && dist <= 0.12) {
          pr = 255;
          pg = 97;
          pb = 97;
        }
      }

      rawData[pxOffset] = pr;
      rawData[pxOffset + 1] = pg;
      rawData[pxOffset + 2] = pb;
      rawData[pxOffset + 3] = pa;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bit depth
  ihdrData[9] = 6; // RGBA color type
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = makeChunk("IHDR", ihdrData);
  const idatChunk = makeChunk("IDAT", deflated);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(len + 12);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, len + 8));
  chunk.writeInt32BE(crc, len + 8);
  return chunk;
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) | 0;
}

fs.writeFileSync(path.join(publicDir, "icon-192.png"), createPng(192, 192));
fs.writeFileSync(path.join(publicDir, "icon-512.png"), createPng(512, 512));
fs.writeFileSync(path.join(publicDir, "icon-maskable.png"), createPng(512, 512));
fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), createPng(180, 180));

console.log("Successfully generated all PWA icon sizes in /public!");
