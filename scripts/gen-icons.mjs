// Generates placeholder PWA icons (no dependencies). Run: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x12, 0x12, 0x12];
const RING = [0xb9, 0xa0, 0x6a];
const RAY = [0xf1, 0xee, 0xe5];
const FOX = [0xe5, 0xc9, 0x8b];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const distToSeg = (px, py, ax, ay, bx, by) => {
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
};

// Shape in unit coords (-1..1). `scale` < 1 shrinks artwork for the maskable safe zone.
function shade(x, y, scale) {
  x /= scale;
  y /= scale;
  const r = Math.hypot(x, y);
  if (Math.abs(r - 0.78) < 0.045) return RING;
  // two bearing rays crossing at the fox
  const fx = 0.18, fy = -0.28;
  if (distToSeg(x, y, -0.55, 0.5, fx + (fx + 0.55) * 0.35, fy + (fy - 0.5) * 0.35) < 0.035) return RAY;
  if (distToSeg(x, y, 0.6, 0.42, fx - (0.6 - fx) * 0.35, fy - (0.42 - fy) * 0.35) < 0.035) return RAY;
  if (Math.abs(x - fx) + Math.abs(y - fy) < 0.14) return FOX;
  if (Math.hypot(x + 0.55, y - 0.5) < 0.07 || Math.hypot(x - 0.6, y - 0.42) < 0.07) return RAY;
  return BG;
}

function png(size, scale) {
  const ss = 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const x = ((px + (sx + 0.5) / ss) / size) * 2 - 1;
          const y = ((py + (sy + 0.5) / ss) / size) * 2 - 1;
          const c = shade(x, y, scale);
          for (let i = 0; i < 3; i++) acc[i] += c[i];
        }
      for (let i = 0; i < 3; i++) raw[py * (size * 3 + 1) + 1 + px * 3 + i] = Math.round(acc[i] / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), png(192, 1));
writeFileSync(new URL('icon-512.png', out), png(512, 1));
writeFileSync(new URL('icon-maskable-512.png', out), png(512, 0.72));
writeFileSync(new URL('apple-touch-icon.png', out), png(180, 0.85));
console.log('icons written to public/icons/');
