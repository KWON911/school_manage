import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const outputDir = path.resolve('icons');
fs.mkdirSync(outputDir, { recursive: true });

function insideRoundedSquare(x, y, size, radius) {
  const cx = Math.max(radius, Math.min(size - radius, x));
  const cy = Math.max(radius, Math.min(size - radius, y));
  return ((x - cx) ** 2 + (y - cy) ** 2) <= radius ** 2;
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])) >>> 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeIcon(size) {
  const supersample = 4;
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 100;
  const house = [[50, 20], [20, 45], [20, 80], [80, 80], [80, 45]];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let white = 0;
      let green = 0;
      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const px = (x + (sx + 0.5) / supersample) / scale;
          const py = (y + (sy + 0.5) / supersample) / scale;
          if (insideRoundedSquare(px, py, 100, 20)) green++;
          if (insidePolygon(px, py, house)) white++;
          if (px >= 40 && px <= 60 && py >= 60 && py <= 80) white--;
          if ((px - 35) ** 2 + (py - 50) ** 2 <= 16 || (px - 65) ** 2 + (py - 50) ** 2 <= 16) white--;
        }
      }
      const index = (y * size + x) * 4;
      const whiteRatio = Math.max(0, white) / (supersample ** 2);
      const greenRatio = green / (supersample ** 2);
      pixels[index] = Math.round(35 * (1 - whiteRatio) + 255 * whiteRatio);
      pixels[index + 1] = Math.round(67 * (1 - whiteRatio) + 255 * whiteRatio);
      pixels[index + 2] = Math.round(54 * (1 - whiteRatio) + 255 * whiteRatio);
      pixels[index + 3] = Math.round(255 * Math.min(1, Math.max(greenRatio, whiteRatio)));
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(path.join(outputDir, `icon-${size}.png`), png);
}

for (const size of [180, 192, 512]) writeIcon(size);
