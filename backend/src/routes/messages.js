import { Router } from 'express';
import pool from '../db.js';
import config from '../config.js';
import { parseTransaction } from '../gemini.js';

const router = Router();

/**
 * POST /api/messages
 * Menerima pesan dari wa-listener, parsing via Gemini, simpan ke DB,
 * kirim konfirmasi balik ke WA.
 */
router.post('/', async (req, res) => {
  try {
    const { from, message, timestamp } = req.body;

    // Validasi input
    if (!from || !message) {
      return res.status(400).json({ error: 'Field "from" dan "message" wajib diisi' });
    }

    // Parse pesan via Gemini
    const parsed = await parseTransaction(message);

    // Cek apakah Gemini gagal atau pesan tidak dikenali
    if (parsed.error) {
      // Kirim balasan error ke WA
      const errorMsg =
        '❌ Format pesan tidak dikenali.\n\nContoh format yang benar:\n' +
        '• keluar 20rb makan siang\n' +
        '• masuk 5jt gaji\n' +
        '• keluar 150k nonton bioskop\n' +
        '• masuk 500rb freelance';

      await sendWaReply(from, errorMsg);
      return res.status(200).json({ status: 'unrecognized', message: errorMsg });
    }

    // Simpan ke database
    const insertQuery = `
      INSERT INTO transactions (wa_number, type, amount, category, description, transaction_date, raw_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, type, amount, category, description, transaction_date
    `;
    const values = [
      from,
      parsed.type,
      parsed.amount,
      parsed.category,
      parsed.description,
      parsed.transaction_date,
      message, // simpan pesan asli untuk audit
    ];

    const result = await pool.query(insertQuery, values);
    const saved = result.rows[0];

    // Format konfirmasi
    const typeLabel = saved.type === 'income' ? 'Masuk' : 'Keluar';
    const emoji = saved.type === 'income' ? '💰' : '💸';
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(saved.amount);

    const confirmMsg =
      `✅ Tercatat!\n\n` +
      `${emoji} ${typeLabel} ${formattedAmount}\n` +
      `📝 ${saved.description}\n` +
      `🏷️ Kategori: ${saved.category}\n` +
      `📅 Tanggal: ${saved.transaction_date}`;

    // Kirim konfirmasi balik ke WA
    await sendWaReply(from, confirmMsg);

    return res.status(201).json({ status: 'saved', transaction: saved });
  } catch (err) {
    console.error('POST /api/messages error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Kirim pesan ke nomor WA via wa-listener internal endpoint
 */
async function sendWaReply(to, text) {
  try {
    await fetch(`${config.waListenerUrl}/internal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text }),
    });
  } catch (err) {
    console.error('Gagal kirim pesan WA:', err.message);
  }
}

export default router;
