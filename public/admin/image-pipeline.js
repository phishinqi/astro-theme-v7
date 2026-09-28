import { readExif } from './exif.js';

export const RASTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

// Stable, ASCII-only file names survive every backend's path sanitising unchanged.
export function uploadName(original) {
  const base =
    original
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

function encode(bitmap, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob?.type === 'image/webp'
          ? resolve(blob)
          : reject(new Error('当前浏览器不支持 WebP 编码，请换用最新版 Chrome、Edge 或 Safari。')),
      'image/webp',
      0.84,
    ),
  );
}

function dominantColor(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, 16, 16);
  const pixels = context.getImageData(0, 0, 16, 16).data;
  const sum = [0, 0, 0];
  for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += pixels[i + c];
  return `#${sum
    .map((v) =>
      Math.round(v / 256)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * Re-encodes an image through a canvas, which drops every byte of EXIF/XMP/GPS. Pass `widths` for
 * responsive variants (R2), or `longEdge` for one image no longer than that (repository uploads).
 * EXIF is read from the original first, only to prefill the form; it never reaches the output.
 */
export async function prepareImage(file, { widths, longEdge }) {
  if (!RASTER_TYPES.includes(file.type)) throw new Error('仅支持 JPEG、PNG、WebP。');
  if (file.size > MAX_BYTES) throw new Error('请上传 20 MB 以下的图片。');
  const exif = readExif(await file.arrayBuffer());
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS)
      throw new Error('图片超过 4000 万像素，请先缩小。');
    const targets = widths
      ? [...new Set(widths.map((w) => Math.min(w, bitmap.width)))].map((width) => ({
          width,
          height: Math.round((bitmap.height * width) / bitmap.width),
        }))
      : [
          (() => {
            const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
            return {
              width: Math.round(bitmap.width * scale),
              height: Math.round(bitmap.height * scale),
            };
          })(),
        ];
    const variants = [];
    for (const size of targets)
      variants.push({ ...size, blob: await encode(bitmap, size.width, size.height) });
    return { exif, color: dominantColor(bitmap), variants };
  } finally {
    bitmap.close();
  }
}
