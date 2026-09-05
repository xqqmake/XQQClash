// 生成 XQQ 图标 (256x256 PNG)
const fs = require('fs');

// 创建一个简单的 BMP/ICO 格式图标
// 使用 Node.js 内置 Buffer 创建一个带 "XQQ" 文字的图标

function createIcon() {
  const size = 256;
  const channels = 4; // RGBA
  const pixels = Buffer.alloc(size * size * channels);

  // 背景色: 深蓝 #0f172a
  const bgR = 15, bgG = 23, bgB = 42;
  // 文字色: 蓝 #3b82f6
  const txR = 59, txG = 130, txB = 246;
  // 强调色: 亮蓝 #60a5fa
  const acR = 96, acG = 165, faB = 250;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * channels;
      const cx = x - size / 2;
      const cy = y - size / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);

      // 圆角矩形背景
      const margin = 20;
      const radius = 40;
      const inRect = x >= margin && x < size - margin && y >= margin && y < size - margin;
      let inRoundRect = inRect;

      if (inRect) {
        const corners = [
          [margin + radius, margin + radius],
          [size - margin - radius, margin + radius],
          [margin + radius, size - margin - radius],
          [size - margin - radius, size - margin - radius]
        ];
        for (const [cx2, cy2] of corners) {
          const dx = x - cx2;
          const dy = y - cy2;
          if ((x < margin + radius || x >= size - margin - radius) &&
              (y < margin + radius || y >= size - margin - radius)) {
            if (Math.sqrt(dx * dx + dy * dy) > radius) inRoundRect = false;
          }
        }
      }

      if (inRoundRect) {
        // 绘制 "XQQ" - 简单像素字体
        const nx = (x - 40) / (size - 80); // 归一化坐标
        const ny = (y - 60) / (size - 120);

        let isText = false;

        // X - 左上区域
        if (nx >= 0.02 && nx <= 0.28 && ny >= 0.15 && ny <= 0.85) {
          const lx = (nx - 0.02) / 0.26;
          const ly = (ny - 0.15) / 0.7;
          // 对角线
          if (Math.abs(lx - ly) < 0.12 || Math.abs(lx - (1 - ly)) < 0.12) isText = true;
        }

        // Q - 中间
        if (nx >= 0.32 && nx <= 0.62 && ny >= 0.15 && ny <= 0.85) {
          const qx = (nx - 0.32) / 0.3;
          const qy = (ny - 0.15) / 0.7;
          const dx2 = qx - 0.5;
          const dy2 = qy - 0.45;
          const r = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (r > 0.3 && r < 0.45) isText = true;
          // Q 的尾巴
          if (qx > 0.55 && qy > 0.6 && (qx - 0.55) + (qy - 0.6) > 0.15 && (qx - 0.55) + (qy - 0.6) < 0.35) isText = true;
        }

        // Q - 右边
        if (nx >= 0.66 && nx <= 0.96 && ny >= 0.15 && ny <= 0.85) {
          const qx = (nx - 0.66) / 0.3;
          const qy = (ny - 0.15) / 0.7;
          const dx2 = qx - 0.5;
          const dy2 = qy - 0.45;
          const r = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (r > 0.3 && r < 0.45) isText = true;
          if (qx > 0.55 && qy > 0.6 && (qx - 0.55) + (qy - 0.6) > 0.15 && (qx - 0.55) + (qy - 0.6) < 0.35) isText = true;
        }

        if (isText) {
          pixels[idx] = acR;
          pixels[idx + 1] = acG;
          pixels[idx + 2] = faB;
          pixels[idx + 3] = 255;
        } else {
          // 渐变背景
          const grad = y / size;
          pixels[idx] = Math.floor(bgR + (30 - bgR) * grad);
          pixels[idx + 1] = Math.floor(bgG + (58 - bgG) * grad);
          pixels[idx + 2] = Math.floor(bgB + (97 - bgB) * grad);
          pixels[idx + 3] = 255;
        }
      } else {
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0; // 透明
      }
    }
  }

  // 写入 PNG (手动构建最小 PNG)
  const png = createPNG(size, size, pixels);
  fs.writeFileSync('icon.png', png);
  console.log('icon.png created (256x256)');
}

function createPNG(width, height, pixels) {
  const chunks = [];

  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(createChunk('IHDR', ihdr));

  // IDAT - compress pixel data with zlib
  const zlib = require('zlib');
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];
      rawData[dstIdx + 1] = pixels[srcIdx + 1];
      rawData[dstIdx + 2] = pixels[srcIdx + 2];
      rawData[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }
  const compressed = zlib.deflateSync(rawData);
  chunks.push(createChunk('IDAT', compressed));

  // IEND
  chunks.push(createChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

createIcon();
