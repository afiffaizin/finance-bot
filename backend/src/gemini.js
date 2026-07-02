import { GoogleGenAI, Type } from '@google/genai';
import config from './config.js';

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

const SYSTEM_PROMPT = `Kamu adalah parser catatan keuangan. Dari pesan pengguna, ekstrak data transaksi keuangan dan kembalikan HANYA dalam format JSON tanpa teks lain, dengan schema:
{
  type: 'income' | 'expense',
  amount: number,
  category: string,
  description: string,
  transaction_date: string (format YYYY-MM-DD, default hari ini jika tidak disebutkan)
}
Aturan konversi jumlah: '20rb' atau '20k' = 20000, '1jt' = 1000000, '1,5jt' = 1500000, '500rb' = 500000, dst.
Kategori harus salah satu dari: makanan, transport, tagihan, gaji, belanja, hiburan, kesehatan, pendidikan, lainnya.
Jika pesan tidak bisa diinterpretasikan sebagai transaksi keuangan, kembalikan { "error": "unrecognized" }.`;

// Schema untuk structured output Gemini
const transactionSchema = {
  type: Type.OBJECT,
  properties: {
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
    error: {
      type: Type.STRING,
      description: 'Diisi "unrecognized" jika pesan bukan transaksi keuangan',
    },
  },
  required: ['type', 'amount', 'category', 'description', 'transaction_date'],
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
