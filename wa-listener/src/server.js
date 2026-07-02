import express from 'express';
import config from './config.js';
import { sendMessage } from './socket.js';

const app = express();
app.use(express.json());

/**
 * POST /internal/send
 * Internal endpoint — dipanggil backend untuk kirim pesan konfirmasi ke WA
 * Body: { to: string, text: string }
 */
app.post('/internal/send', async (req, res) => {
  try {
    const { to, text } = req.body;

    if (!to || !text) {
      return res.status(400).json({ error: 'Field "to" dan "text" wajib diisi' });
    }

    await sendMessage(to, text);
    console.log(`📤 Pesan terkirim ke ${to}`);
    return res.json({ status: 'sent' });
  } catch (err) {
    console.error('❌ Gagal kirim pesan:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start internal HTTP server
 */
export function startServer() {
  app.listen(config.port, () => {
    console.log(`📡 WA Listener internal server running on port ${config.port}`);
  });
}
