import { Router } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/transactions
 * Query params (semua optional):
 *   - start_date  (YYYY-MM-DD)
 *   - end_date    (YYYY-MM-DD)
 *   - category    (string)
 *   - type        (income | expense)
 *   - limit       (number, default 50)
 *   - offset      (number, default 0)
 */
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, category, type, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      conditions.push(`transaction_date >= $${paramIndex++}`);
      params.push(start_date);
    }

    if (end_date) {
      conditions.push(`transaction_date <= $${paramIndex++}`);
      params.push(end_date);
    }

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (type && (type === 'income' || type === 'expense')) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validasi limit & offset
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const query = `
      SELECT id, wa_number, type, amount, category, description, transaction_date, created_at
      FROM transactions
      ${whereClause}
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(safeLimit, safeOffset);

    // Count total untuk pagination
    const countQuery = `SELECT COUNT(*) AS total FROM transactions ${whereClause}`;
    const countParams = params.slice(0, params.length - 2); // tanpa limit & offset

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    return res.json({
      transactions: dataResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
      limit: safeLimit,
      offset: safeOffset,
    });
  } catch (err) {
    console.error('GET /api/transactions error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
