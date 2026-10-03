import sharp from 'sharp';
import { createHash } from 'node:crypto';
export const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export async function imageIdentity(bytes: Buffer) {
 const image = sharp(bytes, { limitInputPixels: 40_000_000 });
 const metadata = await image.metadata();
 const pixels = await image.clone().rotate().resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
 let bits = 0n;
 for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (pixels[y * 9 + x]! > pixels[y * 9 + x + 1]! ? 1n : 0n);
 const thumb = await image.clone().rotate().resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer();
 return { sha256: sha256(bytes), dhash: bits.toString(16).padStart(16, '0'), width: metadata.width!, height: metadata.height!, format: metadata.format!, thumb: thumb.toString('base64') };
}
/** With a limit, return as soon as the distance exceeds it. */
export function hashDistance(a: string, b: string, limit = 64) {
 let bits = BigInt('0x' + a) ^ BigInt('0x' + b), count = 0;
 while (bits && count <= limit) { bits &= bits - 1n; count++; }
 return count;
}
export function sameVisual(a: Awaited<ReturnType<typeof imageIdentity>>, b: Awaited<ReturnType<typeof imageIdentity>>) {
 if (a.sha256 === b.sha256) return true;
 if (Math.abs(a.width / a.height - b.width / b.height) > 0.02 || hashDistance(a.dhash, b.dhash, 2) > 2) return false;
 const left = Buffer.from(a.thumb, 'base64'), right = Buffer.from(b.thumb, 'base64');
 if (left.length !== right.length) return false;
 let square = 0; for (let i = 0; i < left.length; i++) square += (left[i]! - right[i]!) ** 2;
 // Additional pixel comparison prevents unrelated low-detail images sharing dHash.
 return Math.sqrt(square / left.length) <= 8;
}
