import 'dotenv/config';

const config = {
  ownerWaNumber: process.env.OWNER_WA_NUMBER || '',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3002',
  port: parseInt(process.env.PORT, 10) || 3001,
};

// Validasi wajib
if (!config.ownerWaNumber) {
  console.error('FATAL: OWNER_WA_NUMBER belum diset di environment variables');
  process.exit(1);
}

export default config;
