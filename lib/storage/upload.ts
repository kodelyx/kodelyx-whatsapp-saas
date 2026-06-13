import { put } from '@vercel/blob';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Uploads a file to persistent storage and returns a public URL.
 *
 * - On Vercel (BLOB_READ_WRITE_TOKEN present): stores the file in Vercel Blob,
 *   which is persistent and CDN-backed. Vercel's filesystem is read-only at
 *   runtime, so writing to public/ does not work there.
 * - Locally (no token): falls back to writing into public/uploads/<folder>,
 *   keeping the dev experience unchanged.
 *
 * @param file   The uploaded File (from FormData).
 * @param folder Sub-folder/prefix to organise uploads, e.g. "branding".
 * @returns A public URL string usable as an <img>/CSS background source.
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${folder}/${Date.now()}-${safeName}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, file, {
      access: 'public',
      addRandomSuffix: false,
    });
    return blob.url;
  }

  // Local development fallback: write into public/uploads/<folder>.
  const uploadDir = join(process.cwd(), 'public/uploads', folder);
  await mkdir(uploadDir, { recursive: true });
  const filename = `${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(uploadDir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}
