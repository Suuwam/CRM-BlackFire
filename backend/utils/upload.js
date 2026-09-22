const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Cloudinary compresses and resizes on ingest, so what lands in Mongo is a ~100-byte URL
// instead of a multi-MB base64 blob that every board fetch would then have to ship.
// Without Cloudinary configured, small images still inline so the feature keeps working.
const INLINE_MAX = 400 * 1024;

async function storeImage(file, { folder = 'crm_uploads', width = 1280, height = 720 } = {}) {
  if (!file) throw new Error('No image uploaded');

  if (hasCloudinary) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, width, height, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
        (err, out) => (out ? resolve(out) : reject(err)),
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });
    return result.secure_url;
  }

  if (file.size > INLINE_MAX) {
    throw Object.assign(new Error('Image too large (max 400KB without Cloudinary configured)'), { status: 400 });
  }
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

module.exports = { storeImage, hasCloudinary };
