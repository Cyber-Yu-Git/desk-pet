import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const size = 256;
const outputDir = join(process.cwd(), 'build');
const pngPath = join(outputDir, 'icon.png');
const icoPath = join(outputDir, 'icon.ico');

mkdirSync(outputDir, { recursive: true });

const png = createPng(size, size, (x, y) => {
  const cx = x - size / 2;
  const cy = y - size / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);
  const background = mix([37, 99, 235, 255], [20, 184, 166, 255], (x + y) / (size * 2));

  if (!insideRoundedRect(x, y, 24, 24, 208, 208, 46)) {
    return [0, 0, 0, 0];
  }

  if (radius < 88) {
    return background;
  }

  return mix(background, [15, 23, 42, 255], 0.15);
});

drawRoundedRect(png.pixels, size, 54, 72, 148, 104, 28, [255, 255, 255, 235]);
drawRoundedRect(png.pixels, size, 78, 108, 26, 26, 8, [15, 23, 42, 255]);
drawRoundedRect(png.pixels, size, 152, 108, 26, 26, 8, [15, 23, 42, 255]);
drawRoundedRect(png.pixels, size, 100, 150, 56, 12, 6, [15, 23, 42, 255]);
drawRoundedRect(png.pixels, size, 112, 42, 32, 34, 10, [255, 255, 255, 230]);

const pngBuffer = encodePng(size, size, png.pixels);
const icoBuffer = encodeIcoWithPng(pngBuffer);

writeFileSync(pngPath, pngBuffer);
writeFileSync(icoPath, icoBuffer);

console.log(`Generated ${pngPath}`);
console.log(`Generated ${icoPath}`);

function createPng(width, height, painter) {
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = painter(x, y);
      const offset = (y * width + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }

  return { pixels };
}

function drawRoundedRect(pixels, width, x, y, rectWidth, rectHeight, radius, color) {
  for (let py = y; py < y + rectHeight; py += 1) {
    for (let px = x; px < x + rectWidth; px += 1) {
      if (insideRoundedRect(px, py, x, y, rectWidth, rectHeight, radius)) {
        const offset = (py * width + px) * 4;
        pixels[offset] = color[0];
        pixels[offset + 1] = color[1];
        pixels[offset + 2] = color[2];
        pixels[offset + 3] = color[3];
      }
    }
  }
}

function insideRoundedRect(px, py, x, y, width, height, radius) {
  const left = x + radius;
  const right = x + width - radius - 1;
  const top = y + radius;
  const bottom = y + height - radius - 1;
  const cx = px < left ? left : px > right ? right : px;
  const cy = py < top ? top : py > bottom ? bottom : py;
  const dx = px - cx;
  const dy = py - cy;

  return dx * dx + dy * dy <= radius * radius;
}

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', createIhdr(width, height)),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function createIhdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function encodeIcoWithPng(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = 0;
  entry[1] = 0;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

function mix(a, b, amount) {
  return a.map((value, index) => Math.round(value + (b[index] - value) * amount));
}
