import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { connectDb } from './db.js';
import { aiMode } from './services/ai.js';
import { seedIfEmpty } from './seed/seed.js';

import authRoutes from './routes/auth.js';
import caseRoutes from './routes/cases.js';
import evidenceRoutes from './routes/evidence.js';
import linkRoutes from './routes/links.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;

async function main() {
  await connectDb();

  if ((process.env.SEED_ON_START || 'true').toLowerCase() !== 'false') {
    await seedIfEmpty();
  }

  const app = express();
  // CORS_ORIGIN: comma-separated allowlist (e.g. the Netlify site URL). Unset =
  // allow any origin, which is fine when the client is served through a proxy.
  const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  const health = (req, res) =>
    res.json({ ok: true, aiMode: aiMode(), time: new Date().toISOString() });
  app.get('/', health); // Render probes HEAD / for open-port + health checks
  app.get('/api/health', health);

  app.use('/api/auth', authRoutes);
  app.use('/api/cases', caseRoutes);
  app.use('/api', evidenceRoutes); // /api/cases/:id/evidence, /api/evidence/:id/download
  app.use('/api/links', linkRoutes);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    res.status(err.status || 500).json({ error: err.message || 'server error' });
  });

  app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}  (AI mode: ${aiMode()})`);
    if (aiMode() === 'mock') {
      console.log('[server] No usable GEMINI_API_KEY — using deterministic local mock for embeddings + hypotheses.');
    }
  });
}

main().catch((err) => {
  console.error('fatal', err);
  process.exit(1);
});
