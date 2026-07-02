import { connectWhatsApp } from './socket.js';
import { startServer } from './server.js';

async function main() {
  console.log('🚀 Starting WA Listener...');

  // Start internal HTTP server (untuk terima request kirim pesan dari backend)
  startServer();

  // Connect ke WhatsApp
  await connectWhatsApp();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
