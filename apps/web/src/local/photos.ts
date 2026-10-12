import { getPhoto, listPhotos, putPhoto, readState, type LocalPhoto } from './db';

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const invalid = () => new Error('Нужна корректная фотография JPEG, PNG или WebP до 10 МБ и 40 мегапикселей.');
export type ImageInfo = {mime: string; width: number; height: number};

// Bound allocations before decoding: inspect dimensions from actual raster headers.
export function inspectImage(bytes: Uint8Array): ImageInfo {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, count: number) => String.fromCharCode(...bytes.subarray(offset, offset + count));
  let width = 0, height = 0, mime = '';
  if (bytes.length >= 33 && bytes.slice(0,8).every((v,i) => v === [137,80,78,71,13,10,26,10][i]) && ascii(12,4) === 'IHDR') {
    mime = 'image/png'; width = view.getUint32(16); height = view.getUint32(20);
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      if (length > bytes.length - offset - 12) throw invalid();
      if (ascii(offset + 4,4) === 'acTL') throw new Error('Добавь неподвижную фотографию.');
      offset += length + 12;
    }
  } else if (bytes.length >= 30 && ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP') {
    mime = 'image/webp';
    const u24 = (at: number) => bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16;
    if (ascii(12,4) === 'VP8X') {
      if (bytes[20] & 2) throw new Error('Добавь неподвижную фотографию.');
      width = 1 + u24(24); height = 1 + u24(27);
    } else if (ascii(12,4) === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
      width = view.getUint16(26,true) & 16383; height = view.getUint16(28,true) & 16383;
    } else if (ascii(12,4) === 'VP8L' && bytes[20] === 47) {
      width = 1 + ((bytes[21] | bytes[22] << 8) & 16383);
      height = 1 + ((bytes[22] >> 6 | bytes[23] << 2 | bytes[24] << 10) & 16383);
    }
  } else if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216) {
    mime = 'image/jpeg';
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 255) throw invalid();
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (offset + 2 > bytes.length) throw invalid();
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw invalid();
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 8) {
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
      }
      offset += length;
    }
  }
  if (!width || !height || width * height > MAX_PIXELS || width > 32767 || height > 32767) throw invalid();
  return {mime,width,height};
}

export async function sanitizePhoto(input: Blob): Promise<Blob> {
  if (input.size <= 0 || input.size > MAX_PHOTO_BYTES) throw invalid();
  const info = inspectImage(new Uint8Array(await input.arrayBuffer()));
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(new Blob([input], {type:info.mime}), {imageOrientation:'from-image'}); }
  catch { throw invalid(); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_PIXELS) throw invalid();
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не поддерживает обработку фотографий.');
    context.drawImage(bitmap,0,0);
    // Canvas writes new pixels without copying EXIF, XMP, or GPS metadata.
    const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(result => result ? resolve(result) : reject(invalid()), info.mime, .9));
    if (blob.size > MAX_PHOTO_BYTES || !['image/jpeg','image/png','image/webp'].includes(blob.type)) throw invalid();
    return blob;
  } finally { bitmap.close(); }
}

export async function savePhoto(noteId: string, input: Blob, id: string = crypto.randomUUID()): Promise<LocalPhoto> {
  const state = await readState();
  if (!state.notes.some(note => note.id === noteId)) throw new Error('Заметка больше недоступна.');
  if ((await listPhotos(noteId)).length >= 10 && !await getPhoto(id)) throw new Error('В заметке может быть максимум 10 фотографий.');
  const blob = await sanitizePhoto(input);
  const photo: LocalPhoto = {id,note_id:noteId,blob,created_at:new Date().toISOString(),mime_type:blob.type,size_bytes:blob.size};
  await putPhoto(photo); // Rechecks note existence and count atomically.
  return photo;
}

// The caller owns the URL and must release it on refresh, note change, or unmount.
export async function getDirectPhoto(id: string): Promise<{url: string; release: () => void}> {
  const photo = await getPhoto(id);
  if (!photo) throw new Error('Фото больше недоступно.');
  const url = URL.createObjectURL(photo.blob);
  return {url,release:() => URL.revokeObjectURL(url)};
}
