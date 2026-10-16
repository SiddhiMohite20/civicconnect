import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const need = (key, devDefault) => {
  const v = process.env[key] || (isProd ? undefined : devDefault);
  if (!v) throw new Error(`Missing required environment variable ${key}`);
  return v;
};

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`,
  mongoUri: need('MONGODB_URI', 'mongodb://127.0.0.1:27017/civicconnect'),
  jwtAccessSecret: need('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  cookie: {
    secure: isProd,
    sameSite: process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax'),
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
  accessTtlMin: 15,
  refreshTtlDays: 7,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  uploadDir: new URL('../uploads/', import.meta.url).pathname,
  reopenWindowDays: Number(process.env.REOPEN_WINDOW_DAYS) || 14,
  requireClosure: process.env.REQUIRE_CLOSURE !== 'false',
  duplicateRadiusM: 50,
  nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  geocoderUserAgent: process.env.GEOCODER_USER_AGENT || 'CivicConnect/1.0 (set GEOCODER_USER_AGENT)',
};
config.cloudinary.enabled = Boolean(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);
if (isProd && !config.cloudinary.enabled) throw new Error('Cloudinary credentials are required in production');
