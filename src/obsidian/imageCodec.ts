/**
 * Convert between base64 data-URLs (as stored in Asset.frontImage) and Blob
 * (for binary upload/download via the REST API).
 */

export interface DataUrlParts {
  blob: Blob;
  mime: string;
}

/** Parse a `data:image/png;base64,...` URL into a Blob + MIME. */
export function dataUrlToBlob(dataUrl: string): DataUrlParts | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const b64  = match[2];

  // Decode base64 → Uint8Array
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return { blob: new Blob([bytes], { type: mime }), mime };
}

/** Read a Blob into a base64 data-URL. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/** Compute a simple SHA-1 hash of a string for echo-suppression in the sync loop. */
export async function sha1(input: string): Promise<string> {
  const buf  = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
