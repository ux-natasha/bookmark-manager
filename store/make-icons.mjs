// Draws the extension icon (a bookmark ribbon on a rounded square) with 4x supersampling.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };

function png(size) {
  const S = 4, N = size * S;
  const inRound = (x, y) => { const r = 0.22 * N, cx = Math.min(Math.max(x, r), N - r), cy = Math.min(Math.max(y, r), N - r); return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; };
  const inRibbon = (x, y) => { const u = x / N, v = y / N; if (u < 0.3 || u > 0.7 || v < 0.16 || v > 0.84) return false; return v <= 0.84 - 0.2 * (1 - Math.abs(u - 0.5) / 0.2); };
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let bg = 0, fg = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const x = px * S + sx + 0.5, y = py * S + sy + 0.5;
        if (inRound(x, y)) { bg++; if (inRibbon(x, y)) fg++; }
      }
      const total = S * S, a = bg / total, f = bg ? fg / bg : 0;
      const col = [0x2f + (0xf5 - 0x2f) * f, 0x4a + (0xf1 - 0x4a) * f, 0x6b + (0xe8 - 0x6b) * f];
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [16, 32, 48, 128]) writeFileSync(new URL(`../public/icons/icon-${s}.png`, import.meta.url), png(s));
