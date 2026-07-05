import { GoogleGenAI, Type } from '@google/genai';
import config from './config.js';

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

const SYSTEM_PROMPT = `Kamu adalah parser catatan keuangan. Dari pesan pengguna, ekstrak data transaksi keuangan.

Aturan:
- Jika pesan BISA diinterpretasikan sebagai transaksi keuangan, set is_transaction = true dan isi semua field.
- Jika pesan TIDAK BISA diinterpretasikan sebagai transaksi keuangan, set is_transaction = false (field lain boleh diisi nilai default).
- Konversi jumlah: '20rb' atau '20k' = 20000, '1jt' = 1000000, '1,5jt' = 1500000, '500rb' = 500000.
- Kata "keluar"/"bayar"/"beli" = expense. Kata "masuk"/"terima"/"gaji"/"dapat" = income.
- Kategori: makanan, transport, tagihan, gaji, belanja, hiburan, kesehatan, pendidikan, lainnya.
- Tanggal default hari ini jika tidak disebutkan.`;

// Schema untuk structured output Gemini
const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    is_transaction: {
      type: Type.BOOLEAN,
      description: 'true jika pesan bisa diinterpretasikan sebagai transaksi keuangan, false jika tidak',
    },
    type: {
      type: Type.STRING,
      description: 'Jenis transaksi: income atau expense',
      enum: ['income', 'expense'],
    },
    amount: {
      type: Type.NUMBER,
      description: 'Jumlah uang dalam angka bulat (rupiah)',
    },
    category: {
      type: Type.STRING,
      description: 'Kategori transaksi',
      enum: ['makanan', 'transport', 'tagihan', 'gaji', 'belanja', 'hiburan', 'kesehatan', 'pendidikan', 'lainnya'],
    },
    description: {
      type: Type.STRING,
      description: 'Keterangan singkat transaksi',
    },
    transaction_date: {
      type: Type.STRING,
      description: 'Tanggal transaksi format YYYY-MM-DD, default hari ini',
    },
  },
  required: ['is_transaction', 'type', 'amount', 'category', 'description', 'transaction_date'],
};

/**
 * Parse pesan WhatsApp menjadi data transaksi via Gemini API
 * @param {string} message - Teks pesan WA
 * @returns {Promise<object>} Hasil parsing transaksi atau { error: 'unrecognized' }
 */
export async function parseTransaction(message) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dynamicPrompt = SYSTEM_PROMPT.replace('hari ini', `hari ini (${today})`);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: dynamicPrompt,
        responseMimeType: 'application/json',
        responseJsonSchema: transactionSchema,
        thinkingConfig: {
          thinkingBudget: 0, // Matikan thinking untuk respons cepat
        },
      },
    });

    const text = response.text;
    const parsed = JSON.parse(text);
    return parsed;
  } catch (err) {
    console.error('Gemini parse error:', err.message);
    return { error: 'gemini_failed' };
  }
}
