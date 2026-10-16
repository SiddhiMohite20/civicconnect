import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../config.js';
import { detectImage } from '../middleware/upload.js';
import { ApiError } from '../utils/http.js';

if (config.cloudinary.enabled) {
  cloudinary.config({ cloud_name: config.cloudinary.cloudName, api_key: config.cloudinary.apiKey, api_secret: config.cloudinary.apiSecret, secure: true });
}

export async function uploadImage(buffer, folder = 'complaints') {
  const format = detectImage(buffer);
  if (!format) throw new ApiError(415, 'Invalid image', 'BAD_FILE_TYPE');
  if (config.cloudinary.enabled) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: `civicconnect/${folder}`, resource_type: 'image', transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }] },
        (err, r) => (err ? reject(new ApiError(502, 'Image upload failed', 'UPLOAD_FAILED')) : resolve({ url: r.secure_url, publicId: r.public_id, bytes: r.bytes, format: r.format })),
      ).end(buffer);
    });
  }
  // Development fallback only (production requires Cloudinary; see config.js)
  await fs.mkdir(config.uploadDir, { recursive: true });
  const name = `${crypto.randomUUID()}.${format === 'jpeg' ? 'jpg' : format}`;
  await fs.writeFile(path.join(config.uploadDir, name), buffer);
  return { url: `${config.publicUrl}/uploads/${name}`, publicId: name, bytes: buffer.length, format };
}
