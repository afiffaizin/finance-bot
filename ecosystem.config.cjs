/**
 * PM2 Ecosystem Config — BotKeuangan
 *
 * Cara pakai:
 *   pm2 start ecosystem.config.cjs
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *
 * PENTING: Edit variabel di bawah sesuai konfigurasi server kamu.
 */

// ── Konfigurasi ────────────────────────────────────────
const DB_USER     = process.env.POSTGRES_USER     || 'finance_user';
const DB_PASSWORD = process.env.POSTGRES_PASSWORD || 'GANTI_PASSWORD_KUAT';
const DB_NAME     = process.env.POSTGRES_DB       || 'finance_db';
const GEMINI_KEY  = process.env.GEMINI_API_KEY    || 'GANTI_GEMINI_API_KEY';
const WA_NUMBER   = process.env.OWNER_WA_NUMBER   || '62895384922113';
const PROJECT_DIR = '/var/www/finance-bot';

module.exports = {
  apps: [
    // ── Backend (Express + Gemini) ──────────────────────
    {
      name: 'finance-backend',
      cwd: `${PROJECT_DIR}/backend`,
      script: 'src/index.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        DATABASE_URL: `postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}`,
        GEMINI_API_KEY: GEMINI_KEY,
        WA_LISTENER_URL: 'http://localhost:3001',
      },
    },

    // ── WA Listener (Baileys) ───────────────────────────
    {
      name: 'finance-wa-listener',
      cwd: `${PROJECT_DIR}/wa-listener`,
      script: 'src/index.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        OWNER_WA_NUMBER: WA_NUMBER,
        BACKEND_URL: 'http://localhost:3002',
      },
    },

    // ── Dashboard (Next.js Standalone) ──────────────────
    {
      name: 'finance-dashboard',
      cwd: `${PROJECT_DIR}/dashboard/.next/standalone`,
      script: 'server.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
