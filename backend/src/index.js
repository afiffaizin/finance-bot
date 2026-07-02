import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import config from './config.js';
import messagesRouter from './routes/messages.js';
import transactionsRouter from './routes/transactions.js';
import summaryRouter from './routes/summary.js';

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(express.json());
app.use(cors());

// Rate limiting untuk endpoint GET publik (dashboard)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 100,                // maks 100 request per menit per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request, coba lagi nanti' },
});

// ── Routes ─────────────────────────────────────────────────
app.use('/api/messages', messagesRouter);
app.use('/api/transactions', apiLimiter, transactionsRouter);
app.use('/api/summary', apiLimiter, summaryRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ───────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`Backend running on port ${config.port}`);
});
