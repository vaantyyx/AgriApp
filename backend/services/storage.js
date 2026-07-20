// @ts-check
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const CLOUDINARY_ENABLED = !!(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

if (CLOUDINARY_ENABLED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  logger.warn(
    'CLOUDINARY_* env vars not set — profile photos and documents fall back to local disk storage. ' +
    'On hosts with an ephemeral filesystem (Render and most PaaS free tiers), those files are lost on every redeploy/restart/sleep cycle.'
  );
}

export const storageMode = CLOUDINARY_ENABLED ? 'cloudinary' : 'local';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!CLOUDINARY_ENABLED) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const CLOUDINARY_FOLDER = 'sougra/uploads';

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

// Raw (non-image) Cloudinary resources keep their extension as part of the
// public_id; image resources store format separately from the public_id.
function resourceTypeForExt(ext) {
  return ext === '.pdf' ? 'raw' : 'image';
}

/**
 * Persists an uploaded file's buffer and returns an opaque "<uuid><ext>" key
 * to save in the DB — the same shape regardless of which backend is active,
 * so callers (routes, the /uploads serving route) never need to know
 * whether a given file lives on disk or in Cloudinary.
 */
export async function storeFile(buffer, ext) {
  const normalizedExt = ext.toLowerCase();
  const uuid = uuidv4();
  const key = `${uuid}${normalizedExt}`;

  if (!CLOUDINARY_ENABLED) {
    await fsp.writeFile(path.join(UPLOAD_DIR, key), buffer);
    return key;
  }

  const resourceType = resourceTypeForExt(normalizedExt);
  const publicId = resourceType === 'raw' ? key : uuid;

  await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: resourceType, type: 'authenticated', folder: CLOUDINARY_FOLDER },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

  return key;
}

/** Reads back a previously stored file's bytes + content-type, from whichever backend is active. */
export async function readFile(key) {
  const ext = path.extname(key).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

  if (!CLOUDINARY_ENABLED) {
    const buffer = await fsp.readFile(path.join(UPLOAD_DIR, key));
    return { buffer, contentType };
  }

  const resourceType = resourceTypeForExt(ext);
  const uuid = path.basename(key, ext);
  const publicId = resourceType === 'raw' ? key : uuid;
  // Signed on every read rather than cached — the URL is only ever used
  // server-to-server (never handed to the client), so a permanent expiry
  // doesn't matter and this avoids needing Cloudinary's paid token-auth add-on.
  const signedUrl = cloudinary.url(`${CLOUDINARY_FOLDER}/${publicId}`, {
    resource_type: resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
  });

  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Cloudinary fetch failed with status ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}
