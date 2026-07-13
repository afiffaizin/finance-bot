# BotKeuangan — Pencatatan Keuangan Pribadi via WhatsApp

Sistem pencatatan keuangan pribadi otomatis melalui WhatsApp. Kirim pesan seperti **"keluar 20rb makan siang"** dan bot akan mencatat transaksi, menyimpan ke database, serta menampilkan ringkasan di dashboard web.

## Arsitektur

```
                    ┌─────────────────────────────────────────────┐
                    │              Docker Compose                  │
                    │                                             │
┌──────────┐       │  ┌──────────┐    ┌──────────┐    ┌────────┐ │
│ WhatsApp │◄─────►│  │  Nginx   │───►│Dashboard │    │Postgres│ │
│   App    │       │  │ (Reverse │    │(Next.js) │    │  (DB)  │ │
└──────────┘       │  │  Proxy)  │    └──────────┘    └───▲────┘ │
                   │  │  :80/443 │                        │      │
                   │  └────┬─────┘    ┌──────────┐        │      │
                   │       │          │ Backend  │────────┘      │
                   │       └─────────►│(Express) │               │
                   │                  │ +Gemini  │               │
                   │                  └────▲─────┘               │
                   │                       │                     │
                   │                  ┌────┴─────┐               │
                   │                  │   WA     │               │
                   │                  │ Listener │               │
                   │                  │(Baileys) │               │
                   │                  └──────────┘               │
                   └─────────────────────────────────────────────┘
```

| Service | Tech | Port | Expose |
|---------|------|------|--------|
| **nginx** | Nginx 1.27 Alpine | 80/443 | ✅ Public |
| **dashboard** | Next.js 16 + Tailwind + Recharts | 3000 | 🔒 Internal |
| **backend** | Express + Gemini AI | 3002 | 🔒 Internal |
| **wa-listener** | Baileys (WhatsApp Web) | 3001 | 🔒 Internal |
| **postgres** | PostgreSQL 16 Alpine | 5432 | 🔒 Internal |

## Fitur

- 💬 Kirim pesan WA → otomatis dicatat sebagai transaksi
- 🤖 Parsing cerdas via Google Gemini AI (support "20rb", "1jt", "500k", dll)
- 📤 Balasan konfirmasi otomatis ke WhatsApp
- 📊 Dashboard web: ringkasan saldo, grafik tren, pie chart kategori, tabel transaksi
- 🔒 Nginx reverse proxy + SSL/HTTPS support
- 🐳 One-command Docker deploy
- 💾 Auto-backup database harian
- 🛡️ Security: non-root containers, rate limiting, security headers

## Prasyarat

- **Server**: VM/VPS Ubuntu 22.04+ (minimal 2 CPU, 2GB RAM, 20GB disk)
- **Docker**: Docker Engine + Docker Compose V2
- **Gemini API Key**: Gratis dari [Google AI Studio](https://aistudio.google.com/apikey)
- **WhatsApp**: Nomor aktif untuk bot

---

## Quick Start (5 menit)

### 1. Clone & Konfigurasi

```bash
git clone https://github.com/username/BotKeuangan.git
cd BotKeuangan

cp .env.example .env
nano .env
```

Isi variabel wajib:

```env
POSTGRES_PASSWORD=password_kuat_kamu_disini
GEMINI_API_KEY=AIzaSy...api_key_kamu
OWNER_WA_NUMBER=628123456789
```

### 2. Deploy

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

Selesai. Semua service akan berjalan di Docker.

### 3. Scan QR WhatsApp

```bash
docker compose logs -f wa-listener
```

Scan QR code yang muncul di terminal via WhatsApp → **Linked Devices** → **Link a Device**.

> Session tersimpan di Docker volume. Tidak perlu scan ulang setelah restart.

### 4. Test

Kirim pesan WA ke nomor bot:

```
keluar 25rb makan siang nasi padang
```

Bot akan membalas:

```
✅ Tercatat!
💸 Keluar Rp25.000
📝 makan siang nasi padang
🏷️ Kategori: makanan
📅 Tanggal: 2025-06-15
```

### 5. Buka Dashboard

```
http://IP_SERVER
```

---

## Deployment Production (dengan Domain + SSL)

### 1. Setup DNS

Arahkan domain ke IP server:

```
finance-bot.domain.com     → A → IP_SERVER
api.finance-bot.domain.com → A → IP_SERVER
```

### 2. Update .env

```env
DOMAIN=finance-bot.domain.com
API_DOMAIN=api.finance-bot.domain.com
NEXT_PUBLIC_BACKEND_URL=https://api.finance-bot.domain.com
```

### 3. Deploy + SSL

```bash
sudo ./deploy.sh           # Deploy dulu
sudo ./deploy.sh --ssl     # Setup SSL certificate
```

SSL certificate auto-renew via cron job.

---

## Perintah Berguna (Makefile)

```bash
make help              # Tampilkan semua perintah
make up                # Start semua service
make down              # Stop semua service
make restart           # Restart semua service
make status            # Cek status container
make logs              # Lihat semua log (follow)
make logs-wa           # Lihat log wa-listener (scan QR)
make logs-backend      # Lihat log backend
make health            # Cek health semua service
make backup            # Backup database
make restore           # Restore dari backup
make migrate           # Jalankan migrasi database
make seed              # Load data dummy
make shell-db          # Masuk PostgreSQL shell
make shell-backend     # Masuk shell backend
make ssl               # Setup SSL
make ssl-renew         # Renew SSL certificate
make clean             # Hapus container + images (data aman)
make clean-all         # ⚠️ Hapus SEMUA termasuk data
```

Atau langsung pakai Docker Compose:

```bash
docker compose ps                          # Status
docker compose logs -f backend             # Log backend
docker compose exec postgres psql -U finance_user finance_db  # SQL shell
docker compose up -d --build               # Rebuild & restart
docker compose down                        # Stop
```

---

## Deploy Script

```bash
./deploy.sh              # Deploy (HTTP mode)
./deploy.sh --ssl        # Deploy + Setup SSL
./deploy.sh --update     # Rebuild & restart
./deploy.sh --backup     # Backup database
./deploy.sh --restore    # Restore database
./deploy.sh --help       # Help
```

---

## Backup & Restore

### Manual Backup

```bash
make backup
# atau
./backup.sh
```

File backup tersimpan di `backups/finance_db_YYYYMMDD_HHMMSS.sql.gz`

### Auto-Backup

Deploy script otomatis setup cron job: backup setiap hari jam 03:00. Backup >30 hari otomatis dihapus.

### Restore

```bash
make restore
# atau
./deploy.sh --restore
```

---

## Struktur Project

```
BotKeuangan/
├── .env.example              # Template environment variables
├── .gitignore                # Git ignore rules
├── docker-compose.yml        # Docker Compose (production)
├── deploy.sh                 # One-command deploy script
├── backup.sh                 # Database backup script
├── Makefile                  # Shortcut commands
├── README.md                 # Dokumentasi ini
│
├── nginx/                    # Nginx reverse proxy config
│   ├── nginx.conf            # Main nginx config
│   └── conf.d/
│       ├── default.conf.template   # HTTP proxy config
│       └── ssl.conf.template       # HTTPS proxy config
│
├── wa-listener/              # WhatsApp listener (Baileys)
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── config.js
│       ├── socket.js
│       └── server.js
│
├── backend/                  # REST API (Express + Gemini)
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── migrations/
│   └── src/
│       ├── index.js
│       ├── config.js
│       ├── db.js
│       ├── gemini.js
│       ├── migrate.js
│       └── routes/
│
├── database/                 # SQL migrations (auto-run)
│   └── migrations/
│       ├── 001_init.sql
│       └── 002_seed.sql
│
└── dashboard/                # Web dashboard (Next.js)
    ├── Dockerfile
    ├── .dockerignore
    ├── next.config.ts
    ├── package.json
    └── src/
        ├── app/
        ├── components/
        └── lib/
```

---

## Troubleshooting

| Problem | Solusi |
|---------|--------|
| QR code tidak muncul | `docker compose logs -f wa-listener` — tunggu beberapa detik |
| Harus scan QR ulang | Pastikan volume `wa_auth_session` terpasang |
| Backend error 500 | `make logs-backend` — biasanya DB belum ready |
| Dashboard kosong | Cek `NEXT_PUBLIC_BACKEND_URL` di `.env` benar |
| Gemini error | Cek `GEMINI_API_KEY` valid di [AI Studio](https://aistudio.google.com) |
| Pesan WA tidak diproses | Pastikan `OWNER_WA_NUMBER` format `628xxx` tanpa `+` |
| Port 80 sudah dipakai | Ganti `HTTP_PORT=8080` di `.env` |
| Nginx 502 Bad Gateway | Service belum ready — tunggu 30 detik atau `make restart` |
| SSL gagal | Pastikan DNS sudah pointing dan port 80/443 terbuka |

### Reset Total

```bash
# Stop semua & hapus data (⚠️ database hilang!)
docker compose down -v

# Deploy ulang dari awal
sudo ./deploy.sh
```

---

## Security Checklist

- [x] Non-root containers (backend, wa-listener, dashboard)
- [x] Internal network — hanya Nginx yang exposed
- [x] Rate limiting (API + Nginx)
- [x] Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- [x] Gzip compression
- [x] Nginx server token hidden
- [x] Docker resource limits (memory)
- [x] Log rotation (max 10MB × 5 files)
- [x] PostgreSQL SCRAM-SHA-256 auth
- [x] Environment variable validation
- [x] SSL/HTTPS ready

---

## Lisensi

Proyek pribadi untuk penggunaan personal.
