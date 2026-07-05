import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import config from './config.js';

let sock;

export async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_session');

  // Baileys v7 ESM default export
  const initSocket = typeof makeWASocket === 'function' ? makeWASocket : makeWASocket.default;

  sock = initSocket({
    auth: state,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Render QR code di terminal saat login
    if (qr) {
      console.log('\n📱 Scan QR code berikut dengan WhatsApp:');
      console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed (status: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        connectWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ Terhubung ke WhatsApp!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg || !msg.message) return;
      
      let from = msg.key.remoteJid;
      
      // WhatsApp Privacy/Linked Device update: Kadang pesan masuk via ID @lid,
      // tetapi nomor aslinya ada di remoteJidAlt. Kita gunakan nomor aslinya.
      if (from && from.endsWith('@lid') && msg.key.remoteJidAlt) {
        from = msg.key.remoteJidAlt;
      }

      // Filter hanya dari personal chat (bukan grup, bukan status, bukan linked device yang kosong)
      if (!from || from === 'status@broadcast' || from.endsWith('@g.us') || from.endsWith('@lid')) {
        return;
      }

      const senderNumber = from.split('@')[0];
      const ownerNumber = config.ownerWaNumber.replace(/[^0-9]/g, '');

      // HANYA proses pesan di chat dengan nomor WA owner (chat dengan diri sendiri)
      if (senderNumber !== ownerNumber) {
        // Jangan log pesan yang kita kirim ke orang lain agar terminal tidak spam
        if (!msg.key.fromMe) {
          console.log(`Pesan dari nomor tidak dikenal diabaikan: ${senderNumber}`);
        }
        return;
      }

      // Ekstrak teks pesan
      let messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;
      
      // Jika pesan menggunakan fitur pesan sementara (ephemeral)
      if (!messageText && msg.message.ephemeralMessage) {
        const eph = msg.message.ephemeralMessage.message;
        messageText = eph?.conversation || eph?.extendedTextMessage?.text;
      }
      
      if (!messageText) {
        console.log(`Pesan masuk tapi bukan teks (gambar/stiker/dll). Diabaikan.`);
        return;
      }

      // CEGAH INFINITE LOOP: Abaikan pesan balasan dari bot itu sendiri
      // (karena bot membalas dengan ✅ atau ❌, kita abaikan pesan yang diawali simbol tersebut jika dari diri sendiri)
      if (msg.key.fromMe && (messageText.startsWith('✅') || messageText.startsWith('❌'))) {
        return;
      }

      const timestamp = msg.messageTimestamp;

      console.log(`📩 Pesan masuk dari ${senderNumber}: ${messageText}`);

      // Forward ke backend
      const response = await fetch(`${config.backendUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, message: messageText, timestamp })
      });

      if (!response.ok) {
        console.error(`❌ Gagal forward ke backend: ${response.statusText}`);
      } else {
        console.log(`✅ Pesan berhasil diteruskan ke backend`);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error.message);
    }
  });
}

export async function sendMessage(to, text) {
  if (!sock) {
    throw new Error('WhatsApp socket is not connected');
  }
  await sock.sendMessage(to, { text });
}
