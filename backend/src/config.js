import 'dotenv/config';

const config = {
  port: parseInt(process.env.PORT, 10) || 3002,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://finance_user:finance_pass@localhost:5432/finance_db',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  waListenerUrl: process.env.WA_LISTENER_URL || 'http://localhost:3001',
};

// Validasi wajib
if (!config.geminiApiKey) {
  console.error('FATAL: GEMINI_API_KEY belum diset di environment variables');
  process.exit(1);
}

export default config;
