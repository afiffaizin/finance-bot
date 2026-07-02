Stack:

- WA Listener: Baileys (Node.js, unofficial WhatsApp Web API)
- Backend: Node.js + Express
- Parsing pesan: Google Gemini API
- Database: PostgreSQL (self-hosted di Proxmox)
- Dashboard: Next.js + Tailwind CSS + Recharts
- Hosting: Self-hosted di server Proxmox (VM/LXC pribadi)

---

## MASTER PROMPT

```
Saya ingin membangun sistem pencatatan keuangan pribadi otomatis melalui WhatsApp.
Buatkan seluruh project berikut dengan struktur folder yang rapi dan lengkap.

KONTEKS DEPLOYMENT:
Saya punya server sendiri berbasis Proxmox. Saya akan menjalankan semua service
ini di dalam VM/LXC container Ubuntu 22.04 di server tersebut, jadi buat semua
konfigurasi agar mudah dijalankan dengan Docker Compose dan/atau PM2, bukan
tergantung platform cloud (Vercel/Railway/dst).

ARSITEKTUR:
1. wa-listener: service Node.js menggunakan library Baileys untuk connect ke
   WhatsApp, menerima pesan masuk dari nomor saya sendiri, dan meneruskan isi
   pesan ke backend API via HTTP POST (atau bisa langsung digabung jadi 1
   service dengan backend, sesuaikan mana yang lebih maintainable).
2. backend: REST API Node.js + Express yang:
   - Menerima teks pesan WA
   - Mengirim teks tersebut ke Google Gemini API dengan prompt yang mengekstrak:
     jenis transaksi (masuk/keluar), jumlah (angka murni, ubah "20rb"/"20k"
     jadi 20000), kategori (makanan, transport, gaji, tagihan, hiburan, lainnya,
     dst — tentukan sendiri berdasarkan konteks), keterangan singkat, dan tanggal
     (default hari ini kalau tidak disebutkan)
   - Gemini harus mengembalikan JSON terstruktur (gunakan responseSchema /
     JSON mode agar output selalu valid JSON, bukan teks bebas)
   - Menyimpan hasil parsing ke database PostgreSQL
   - Mengirim balasan konfirmasi otomatis ke WhatsApp user (via wa-listener)
     berisi ringkasan transaksi yang berhasil dicatat
   - Menyediakan REST endpoint (GET) untuk dashboard: list transaksi (dengan
     filter tanggal/kategori/jenis), ringkasan total per bulan, ringkasan per
     kategori
3. database: PostgreSQL dengan skema tabel "transactions" berisi kolom:
   id (uuid, primary key), wa_number (text), type (enum: income/expense),
   amount (numeric), category (text), description (text), transaction_date
   (date), raw_message (text, simpan pesan asli untuk audit), created_at
   (timestamp default now())
   Sertakan file migration SQL.
4. dashboard: aplikasi Next.js (App Router) + Tailwind CSS + Recharts yang:
   - Menampilkan ringkasan saldo (total masuk, total keluar, saldo bersih)
   - Grafik line/bar chart tren pemasukan vs pengeluaran per bulan (Recharts)
   - Grafik pie chart pengeluaran per kategori
   - Tabel daftar transaksi terbaru dengan filter tanggal dan kategori
   - Fetch data dari backend REST API di atas
   - Desain bersih, mobile-friendly, gunakan Tailwind

REQUIREMENTS TAMBAHAN:
- Gunakan environment variables untuk semua kredensial (Gemini API key,
  koneksi database, port service, dll), sediakan file .env.example
- Sediakan docker-compose.yml yang menjalankan: postgres, backend (+wa-listener
  kalau digabung), dan dashboard, semuanya dalam satu network Docker, siap
  dijalankan di server Proxmox saya
- Sertakan instruksi setup lengkap di README.md: cara install dependencies,
  cara scan QR code Baileys pertama kali, cara migrate database, cara build
  & jalankan semua service
- Session auth Baileys harus disimpan persisten di volume/folder agar tidak
  perlu scan ulang QR setiap kali container restart
- Tambahkan validasi dasar & error handling (misal: kalau Gemini gagal parsing,
  balas ke user "format pesan tidak dikenali, coba format: keluar 20000 makan siang")
- Tambahkan rate limiting sederhana di endpoint API publik dashboard

Tolong buat step-by-step, mulai dari struktur folder, lalu isi tiap file.
```

---

## PROMPT 1 — WA Listener (Baileys)

```
Buatkan service Node.js bernama "wa-listener" menggunakan library
@whiskeysockets/baileys (versi terbaru) dengan spesifikasi:

- Connect ke WhatsApp menggunakan multi-file auth state, simpan session di
  folder ./auth_session agar persisten antar restart
- Tampilkan QR code di terminal (pakai qrcode-terminal) saat pertama kali
  perlu login
- Auto-reconnect kalau koneksi terputus, kecuali kalau user logout manual
- Listen event "messages.upsert", filter hanya pesan teks masuk dari chat
  pribadi (bukan grup), dan HANYA proses pesan dari nomor WA saya sendiri
  (nomor akan saya masukkan lewat env variable OWNER_WA_NUMBER) supaya tidak
  ada orang lain yang bisa mengisi data keuangan saya
- Setiap pesan masuk yang valid, kirim HTTP POST ke backend di endpoint
  BACKEND_URL/api/messages dengan body { from, message, timestamp }
- Sediakan fungsi sendMessage(to, text) yang di-expose lewat endpoint HTTP
  internal (misal POST /internal/send) supaya backend bisa memanggil balik
  untuk mengirim pesan konfirmasi ke user
- Tulis dalam JavaScript modern (ES modules), beri komentar secukupnya,
  dan buatkan Dockerfile untuk service ini
```

---

## PROMPT 2 — Backend Express + Integrasi Gemini

```
Buatkan backend REST API Node.js + Express bernama "backend" dengan struktur:

ENDPOINT:
1. POST /api/messages
   - Terima { from, message, timestamp } dari wa-listener
   - Kirim `message` ke Google Gemini API (model gemini-2.0-flash atau
     terbaru yang tersedia) dengan system prompt berikut:

     "Kamu adalah parser catatan keuangan. Dari pesan pengguna, ekstrak data
     transaksi keuangan dan kembalikan HANYA dalam format JSON tanpa teks lain,
     dengan schema:
     {
       type: 'income' | 'expense',
       amount: number,
       category: string,
       description: string,
       transaction_date: string (format YYYY-MM-DD, default hari ini jika
         tidak disebutkan)
     }
     Aturan konversi jumlah: '20rb' atau '20k' = 20000, '1jt' = 1000000, dst.
     Kategori harus salah satu dari: makanan, transport, tagihan, gaji,
     belanja, hiburan, kesehatan, pendidikan, lainnya.
     Jika pesan tidak bisa diinterpretasikan sebagai transaksi keuangan,
     kembalikan { error: 'unrecognized' }."

   - Gunakan Gemini structured output / responseSchema supaya hasil selalu
     JSON valid (jangan andalkan parsing string manual)
   - Simpan hasil ke tabel `transactions` di PostgreSQL (pakai library `pg`
     atau ORM ringan seperti Drizzle/Prisma — pilih salah satu, jelaskan
     alasan pemilihannya)
   - Panggil balik wa-listener (POST ke WA_LISTENER_URL/internal/send) untuk
     mengirim pesan konfirmasi berisi ringkasan transaksi, format contoh:
     "✅ Tercatat: Keluar Rp20.000 - makan siang (kategori: makanan)"
   - Kalau Gemini mengembalikan error/unrecognized, kirim balasan WA yang
     menjelaskan format yang benar

2. GET /api/transactions
   - Query params: start_date, end_date, category, type (semua optional)
   - Return list transaksi terurut dari terbaru

3. GET /api/summary
   - Return ringkasan: total_income, total_expense, balance untuk periode
     tertentu (query param month=YYYY-MM), plus breakdown per kategori
     (array of { category, total })

NON-FUNCTIONAL:
- Gunakan dotenv untuk semua config (DATABASE_URL, GEMINI_API_KEY,
  WA_LISTENER_URL, PORT)
- Tambahkan middleware CORS supaya dashboard Next.js bisa fetch
- Tambahkan basic rate limiting untuk endpoint GET (pakai express-rate-limit)
- Validasi input dasar untuk semua endpoint
- Buatkan file migration SQL terpisah (migrations/001_init.sql) untuk tabel
  transactions sesuai skema yang saya sebutkan sebelumnya
- Buatkan Dockerfile untuk service backend ini
```

---

## PROMPT 3 — Database PostgreSQL (Migration & Skema)

```
Buatkan file SQL migration untuk PostgreSQL dengan nama migrations/001_init.sql
berisi:

- Extension "pgcrypto" atau "uuid-ossp" untuk generate UUID
- Tabel transactions:
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
  wa_number TEXT NOT NULL
  type TEXT NOT NULL CHECK (type IN ('income','expense'))
  amount NUMERIC(14,2) NOT NULL
  category TEXT NOT NULL
  description TEXT
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE
  raw_message TEXT
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()

- Index pada (transaction_date), (category), (type) untuk mempercepat query
  dashboard
- Buatkan juga script seed data dummy (10-15 baris transaksi contoh) untuk
  testing dashboard sebelum data asli masuk
```

---

## PROMPT 4 — Dashboard Next.js + Tailwind + Recharts

```
Buatkan aplikasi dashboard menggunakan Next.js (App Router, TypeScript) +
Tailwind CSS + Recharts bernama "dashboard" dengan halaman utama yang berisi:

1. Header: judul "Dashboard Keuangan" + filter bulan (dropdown/date picker)

2. Tiga kartu ringkasan (cards) di bagian atas:
   - Total Pemasukan (hijau)
   - Total Pengeluaran (merah)
   - Saldo Bersih (biru/netral)
   Data diambil dari GET {BACKEND_URL}/api/summary?month=YYYY-MM

3. Chart tren bulanan: LineChart atau BarChart (Recharts) menampilkan
   pemasukan vs pengeluaran per hari dalam bulan yang dipilih

4. Chart distribusi kategori: PieChart (Recharts) menampilkan proporsi
   pengeluaran per kategori pada bulan tersebut

5. Tabel daftar transaksi terbaru dengan kolom: tanggal, jenis (badge
   berwarna), kategori, keterangan, jumlah. Sediakan filter kategori dan
   jenis transaksi di atas tabel. Data dari GET {BACKEND_URL}/api/transactions

TEKNIS:
- Gunakan fetch di server component sebisa mungkin untuk data awal, dan
  client component untuk bagian interaktif (filter, chart)
- Gunakan environment variable NEXT_PUBLIC_BACKEND_URL untuk base URL API
- Desain clean, gunakan palet warna netral + aksen hijau/merah untuk
  income/expense, responsive untuk mobile
- Tambahkan loading state & empty state (kalau belum ada transaksi)
- Buatkan Dockerfile untuk dashboard ini (multi-stage build, production mode)
```

---

## PROMPT 5 — Docker Compose & Deployment ke Proxmox

```
Saya punya server Proxmox dengan sebuah VM/LXC Ubuntu 22.04 yang sudah saya
siapkan (sudah ada Docker & Docker Compose terinstall). Buatkan:

1. docker-compose.yml di root project yang menjalankan 4 service:
   - postgres (image postgres:16, dengan volume persistent untuk data,
     env POSTGRES_USER/PASSWORD/DB, expose port hanya ke internal network)
   - wa-listener (build dari ./wa-listener, volume persistent untuk folder
     auth_session, restart: unless-stopped)
   - backend (build dari ./backend, depends_on postgres & wa-listener,
     restart: unless-stopped)
   - dashboard (build dari ./dashboard, expose port 3000, restart:
     unless-stopped)
   Semua service dalam 1 custom network bernama "finance-net"

2. File .env.example di root berisi semua variable yang dibutuhkan semua
   service (DATABASE_URL, GEMINI_API_KEY, OWNER_WA_NUMBER, dst)

3. Panduan singkat di README.md bagian "Deployment ke Proxmox":
   - Cara clone repo ke VM/LXC
   - Cara isi file .env dari .env.example
   - Cara jalankan `docker compose up -d --build`
   - Cara melihat log wa-listener untuk scan QR pertama kali
     (`docker compose logs -f wa-listener`)
   - Cara setup reverse proxy dengan Nginx (atau Nginx Proxy Manager) supaya
     dashboard bisa diakses via domain/subdomain dengan HTTPS (Let's Encrypt)
   - Cara backup volume PostgreSQL secara berkala (contoh cron job
     pg_dump ke file, disimpan di luar container)

Tolong buatkan semua file di atas dengan lengkap dan siap dijalankan.
```

---
