// Reads the handful of EXIF fields the album form can prefill. Supports JPEG (APP1), WebP (EXIF
// chunk) and PNG (eXIf chunk). Never throws: malformed or missing metadata yields {}.
const TAGS = {
  0x010f: 'make',
  0x0110: 'model',
  0x0131: 'software',
  0x8769: 'exifPointer',
  0x829a: 'exposureTime',
  0x829d: 'fNumber',
  0x8827: 'iso',
  0x9003: 'dateTimeOriginal',
  0x920a: 'focalLength',
  0xa434: 'lensModel',
};
const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function tiffSegment(view) {
  const u32 = (offset) => view.getUint32(offset);
  const ascii = (offset, length) =>
    String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + offset, length));
  if (view.byteLength >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 <= view.byteLength && view.getUint8(offset) === 0xff) {
      const marker = view.getUint8(offset + 1);
      const length = view.getUint16(offset + 2);
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xe1 && ascii(offset + 4, 6) === 'Exif\0\0')
        return new DataView(view.buffer, view.byteOffset + offset + 10, length - 8);
      offset += 2 + length;
    }
    return null;
  }
  if (view.byteLength >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    let offset = 12;
    while (offset + 8 <= view.byteLength) {
      const size = view.getUint32(offset + 4, true);
      if (ascii(offset, 4) === 'EXIF') {
        const start = ascii(offset + 8, 6) === 'Exif\0\0' ? offset + 14 : offset + 8;
        return new DataView(view.buffer, view.byteOffset + start, size - (start - offset - 8));
      }
      offset += 8 + size + (size % 2);
    }
    return null;
  }
  if (view.byteLength >= 8 && u32(0) === 0x89504e47) {
    let offset = 8;
    while (offset + 8 <= view.byteLength) {
      const size = u32(offset);
      if (ascii(offset + 4, 4) === 'eXIf')
        return new DataView(view.buffer, view.byteOffset + offset + 8, size);
      offset += 12 + size;
    }
  }
  return null;
}

function readIfd(tiff, offset, little, into) {
  const count = tiff.getUint16(offset, little);
  for (let i = 0; i < count; i++) {
    const entry = offset + 2 + i * 12;
    const name = TAGS[tiff.getUint16(entry, little)];
    if (!name) continue;
    const type = tiff.getUint16(entry + 2, little);
    const items = tiff.getUint32(entry + 4, little);
    const size = (SIZES[type] || 1) * items;
    const at = size > 4 ? tiff.getUint32(entry + 8, little) : entry + 8;
    if (at + size > tiff.byteLength) continue;
    if (type === 2) {
      const bytes = new Uint8Array(tiff.buffer, tiff.byteOffset + at, items);
      into[name] = new TextDecoder()
        .decode(bytes)
        .replace(/\0[\s\S]*$/, '')
        .trim();
    } else if (type === 3) into[name] = tiff.getUint16(at, little);
    else if (type === 4) into[name] = tiff.getUint32(at, little);
    else if (type === 5 || type === 10) {
      const read = type === 5 ? 'getUint32' : 'getInt32';
      const denominator = tiff[read](at + 4, little);
      into[name] = denominator ? [tiff[read](at, little), denominator] : null;
    }
  }
}

export function readExif(buffer) {
  try {
    const tiff = tiffSegment(new DataView(buffer));
    if (!tiff || tiff.byteLength < 8) return {};
    const order = tiff.getUint16(0);
    if (order !== 0x4949 && order !== 0x4d4d) return {};
    const little = order === 0x4949;
    const raw = {};
    readIfd(tiff, tiff.getUint32(4, little), little, raw);
    if (raw.exifPointer) readIfd(tiff, raw.exifPointer, little, raw);
    return formatExif(raw);
  } catch {
    return {};
  }
}

const trimNumber = (value, digits = 1) => String(Number(value.toFixed(digits)));
export function formatExif(raw) {
  const result = {};
  const make = raw.make?.trim();
  const model = raw.model?.trim();
  if (model)
    result.camera =
      make && !model.toLowerCase().startsWith(make.toLowerCase().split(' ')[0])
        ? `${make} ${model}`
        : model;
  else if (make) result.camera = make;
  if (raw.lensModel) result.lens = raw.lensModel;
  if (raw.focalLength)
    result.focalLength = `${trimNumber(raw.focalLength[0] / raw.focalLength[1])}mm`;
  if (raw.fNumber) result.aperture = `f/${trimNumber(raw.fNumber[0] / raw.fNumber[1])}`;
  if (raw.exposureTime) {
    const [n, d] = raw.exposureTime;
    const seconds = n / d;
    result.shutter = seconds >= 1 ? `${trimNumber(seconds)}s` : `1/${Math.round(d / n)}s`;
  }
  if (typeof raw.iso === 'number' && raw.iso > 0) result.iso = raw.iso;
  if (raw.software) result.software = raw.software;
  // Day precision is enough for a photo, and avoids guessing a timezone the camera did not record.
  const date = raw.dateTimeOriginal?.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (date && date[1] !== '0000') result.date = `${date[1]}-${date[2]}-${date[3]}`;
  return result;
}
