// Generates the placeholder app-icon assets for the Yuhmyuhm mobile app.
//
// These are TEMPORARY placeholders, not final branding: a brand-coloured ring
// on the site's "ink" background. They exist so the Expo config is valid and a
// future Android APK has a launchable icon. Replace them with real Yuhmyuhm
// artwork (1024x1024 PNG) before release.
//
// Implemented with Node's built-in zlib only, so it needs no image library.
//
// Usage:  node scripts/generate-placeholder-assets.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'assets');
mkdirSync(outDir, { recursive: true });

// --- brand colours (mirrors src/theme/colors.ts) ---------------------------
const INK = [42, 26, 16];
const ACCENT = [168, 145, 47];
const CREAM = [250, 247, 241];
const TRANSPARENT = [0, 0, 0, 0];

// --- PNG encoding ----------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/** Encodes an RGBA PNG. `pixel(x, y)` returns `[r, g, b, a]`. */
function encodePng(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    raw[cursor] = 0; // filter type: none
    cursor += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      raw[cursor] = r;
      raw[cursor + 1] = g;
      raw[cursor + 2] = b;
      raw[cursor + 3] = a;
      cursor += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A simple branded mark: a centred accent ring.
 * `background` is drawn inside the ring and behind it (null = transparent).
 */
function makeRing(size, { background, ring, ringRatio }) {
  const centre = size / 2;
  const outer = size * ringRatio;
  const thickness = size * 0.045;
  const inner = outer - thickness;

  return encodePng(size, size, (x, y) => {
    const dx = x + 0.5 - centre;
    const dy = y + 0.5 - centre;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= inner) return background ?? TRANSPARENT;
    if (distance <= outer) return [...ring, 255];
    return background ?? TRANSPARENT;
  });
}

const files = [
  // Launcher icon: ring on ink.
  ['icon.png', makeRing(1024, { background: INK, ring: ACCENT, ringRatio: 0.3 })],
  // Adaptive foreground: transparent so android.adaptiveIcon.backgroundColor
  // (ink) shows through.
  ['adaptive-icon.png', makeRing(1024, { background: null, ring: ACCENT, ringRatio: 0.26 })],
  // Web favicon (small).
  ['favicon.png', makeRing(48, { background: INK, ring: ACCENT, ringRatio: 0.32 })],
];

for (const [name, buffer] of files) {
  writeFileSync(join(outDir, name), buffer);
  console.log(`wrote assets/${name} (${buffer.length} bytes)`);
}

console.log('Placeholder assets generated. These are NOT final branding.');
