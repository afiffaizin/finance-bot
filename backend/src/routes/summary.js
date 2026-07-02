import { Router } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/summary
 * Query params:
 *   - month (YYYY-MM, default bulan ini)
 */
router.get('/', async (req, res) => {
  try {
    // Default bulan ini
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const month = req.query.month || defaultMonth;

    // Validasi format YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Format month harus YYYY-MM' });
    }

    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01`;
    // Hari terakhir bulan tersebut
    const endDate = new Date(parseInt(year, 10), parseInt(mon, 10), 0)
      .toISOString()
      .split('T')[0];

    // Total income & expense
    const totalsQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
      FROM transactions
      WHERE transaction_date >= $1 AND transaction_date <= $2
    `;
    const totalsResult = await pool.query(totalsQuery, [startDate, endDate]);
    const { total_income, total_expense } = totalsResult.rows[0];
    const balance = parseFloat(total_income) - parseFloat(total_expense);

    // Breakdown per kategori
    const categoryQuery = `
      SELECT category, type, COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE transaction_date >= $1 AND transaction_date <= $2
      GROUP BY category, type
      ORDER BY total DESC
    `;
    const categoryResult = await pool.query(categoryQuery, [startDate, endDate]);

    // Trend harian (untuk chart di dashboard)
    const dailyQuery = `
      SELECT
        transaction_date,
        COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
      FROM transactions
      WHERE transaction_date >= $1 AND transaction_date <= $2
      GROUP BY transaction_date
      ORDER BY transaction_date ASC
    `;
    const dailyResult = await pool.query(dailyQuery, [startDate, endDate]);

    return res.json({
      month,
      total_income: parseFloat(total_income),
      total_expense: parseFloat(total_expense),
      balance,
      categories: categoryResult.rows.map((row) => ({
        category: row.category,
        type: row.type,
        total: parseFloat(row.total),
      })),
      daily: dailyResult.rows.map((row) => ({
        date: row.transaction_date,
        income: parseFloat(row.income),
        expense: parseFloat(row.expense),
      })),
    });
  } catch (err) {
    console.error('GET /api/summary error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
