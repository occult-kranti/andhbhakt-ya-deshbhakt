/** Optional local portrait. Raw bytes and metadata never leave this device. */
export const PORTRAIT_KEY = 'hisaab:portrait:v1';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
const listeners = new Set();
let volatile;

export function photoInputError(file) {
  if (!file || !PHOTO_TYPES.includes(file.type)) return 'Choose a JPG, PNG or WebP photo.';
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_PHOTO_BYTES) return 'Choose a photo smaller than 5 MB.';
  return null;
}
export function validPortrait(value) {
  return typeof value === 'string' && value.length <= 900000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);
}
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
export function readPortrait() {
  if (volatile !== undefined) return volatile;
  try { const value = storage()?.getItem(PORTRAIT_KEY); return validPortrait(value) ? value : null; } catch { return null; }
}
export function savePortrait(value) {
  if (value !== null && !validPortrait(value)) throw new Error('That photo could not be saved. Choose another image.');
  volatile = value;
  let persisted = false;
  try {
    const target = storage();
    if (target) { value ? target.setItem(PORTRAIT_KEY, value) : target.removeItem(PORTRAIT_KEY); persisted = true; }
  } catch { /* Quota or blocked storage: keep the photo for this visit. */ }
  for (const callback of listeners) callback();
  return { persisted };
}
export function subscribePortrait(callback) {
  listeners.add(callback);
  const onStorage = event => { if (event.key === PORTRAIT_KEY || event.key === null) { volatile = undefined; callback(); } };
  globalThis.addEventListener?.('storage', onStorage);
  return () => { listeners.delete(callback); globalThis.removeEventListener?.('storage', onStorage); };
}
export async function normalizePortrait(file) {
  const error = photoInputError(file);
  if (error) throw new Error(error);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('This photo could not be opened. Try a different image.')); image.src = url; });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Choose a photo up to 40 megapixels.');
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Photos are unavailable in this browser. You can still share a certificate.');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 640, 640);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 640, 640);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally { URL.revokeObjectURL(url); }
}
