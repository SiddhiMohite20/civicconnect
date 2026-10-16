import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { sanitize, errorHandler } from './utils/http.js';
import { originCheck } from './middleware/auth.js';
import auth from './routes/auth.js';
import meta from './routes/meta.js';
import geo from './routes/geo.js';
import complaints from './routes/complaints.js';
import notifications from './routes/notifications.js';
import map from './routes/map.js';
import admin from './routes/admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Render/Vercel proxies
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: (o, cb) => cb(null, !o || config.clientOrigins.includes(o)), credentials: true }));
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitize);
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  app.use(originCheck);
  if (!config.isProd) app.use('/uploads', express.static(config.uploadDir)); // dev-only local image fallback

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', auth);
  app.use('/api/meta', meta);
  app.use('/api/geo', geo);
  app.use('/api/complaints', complaints);
  app.use('/api/notifications', notifications);
  app.use('/api/map', map);
  app.use('/api/admin', admin);
  app.use((_req, res) => res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' }));
  app.use(errorHandler);
  return app;
}
