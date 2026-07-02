# BotKeuangan — Pencatatan Keuangan Pribadi via WhatsApp

Sistem pencatatan keuangan pribadi otomatis melalui WhatsApp. Kirim pesan seperti **"keluar 20rb makan siang"** dan bot akan mencatat transaksi, menyimpan ke database, serta menampilkan ringkasan di dashboard web.

## Arsitektur

```
┌──────────────┐     HTTP POST      ┌──────────────┐     Gemini API
│  WhatsApp    │ ──────────────────► │   Backend    │ ◄──────────────►  Google AI
│  (Baileys)   │ ◄────────────────── │  (Express)   │
│  wa-listener │   konfirmasi WA     │              │
└──────────────┘                     └──────┬───────┘
                                            │ SQL
                                     ┌──────▼───────┐
                                     │  PostgreSQL   │
                                     │   Database    │
                                     └──────┬───────┘
                                            │ REST API
                                     ┌──────▼───────┐
                                     │  Dashboard   │
                                     │  (Next.js)   │
                                     └──────────────┘
```

| Service | Tech | Port |
|---------|------|------|
| **wa-listener** | Node.js + Baileys | 3001 (internal) |
| **backend** | Node.js + Express + Gemini | 3002 (internal) |
| **postgres** | PostgreSQL 16 | 5432 (internal) |
| **dashboard** | Next.js + Tailwind + Recharts | 3000 (exposed) |

## Fitur

- Kirim pesan WA → otomatis dicatat sebagai transaksi
- Parsing cerdas via Google Gemini AI (support "20rb", "1jt", "500k", dll)
- Balasan konfirmasi otomatis ke WhatsApp
- Dashboard web: ringkasan saldo, grafik tren, pie chart kategori, tabel transaksi
- Filter berdasarkan bulan, kategori, dan jenis transaksi
- Hanya proses pesan dari nomor pemilik (aman)
- Self-hosted, semua data di server sendiri

## Prasyarat

- **Server**: VM/LXC Ubuntu 22.04 di Proxmox (atau server Linux lainnya)
- **Docker**: Docker Engine + Docker Compose terinstall
- **Gemini API Key**: Gratis dari [Google AI Studio](https://aistudio.google.com/apikey)
- **WhatsApp**: Nomor aktif untuk bot (akan di-scan QR)

---

## Quick Start

### 1. Clone Repository

```bash
cd /opt
git clone https://github.com/username/BotKeuangan.git
cd BotKeuangan
```

### 2. Konfigurasi Environment

```bash
cp .env.example .env
nano .env
```

Isi variabel berikut:

```env
POSTGRES_PASSWORD=password_kuat_kamu
GEMINI_API_KEY=AIzaSy...api_key_kamu
OWNER_WA_NUMBER=628123456789
NEXT_PUBLIC_BACKEND_URL=http://IP_SERVER:3002
```

> **Penting:** `NEXT_PUBLIC_BACKEND_URL` harus URL yang bisa diakses oleh **browser** kamu (bukan internal Docker). Jika pakai reverse proxy, gunakan `https://api.domain-kamu.com`.

### 3. Build & Jalankan

```bash
docker compose up -d --build
```

Proses build pertama kali bisa memakan waktu 3-5 menit.

### 4. Scan QR Code WhatsApp

```bash
docker compose logs -f wa-listener
```

Akan muncul QR code di terminal. Scan dengan WhatsApp di HP kamu:
1. Buka WhatsApp → **Linked Devices** → **Link a Device**
2. Scan QR code yang tampil di terminal
3. Tunggu sampai muncul pesan `✅ Terhubung ke WhatsApp!`
4. Tekan `Ctrl+C` untuk keluar dari log

> Session tersimpan persisten di Docker volume. Tidak perlu scan ulang setelah restart.

### 5. Migrasi Database

Database otomatis ter-migrasi saat container postgres pertama kali start (via file SQL di `docker-entrypoint-initdb.d`).

Jika perlu migrasi manual:

```bash
docker compose exec backend node src/migrate.js
```

### 6. Test Kirim Pesan

Kirim pesan WhatsApp ke nomor bot kamu sendiri:

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

### 7. Buka Dashboard

Buka browser: `http://IP_SERVER:3000`

---

## Deployment ke Proxmox

### Setup VM/LXC

1. Buat VM atau LXC container Ubuntu 22.04 di Proxmox
2. Alokasikan minimal: 2 CPU, 2GB RAM, 20GB disk
3. Install Docker:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Logout dan login ulang agar group docker aktif
```

### Setup Reverse Proxy (Nginx)

Supaya dashboard dan API bisa diakses via domain dengan HTTPS:

#### Install Nginx

```bash
sudo apt install nginx -y
```

#### Konfigurasi Dashboard

```bash
sudo nano /etc/nginx/sites-available/finance-dashboard
```

```nginx
server {
    listen 80;
    server_name dashboard.domain-kamu.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Konfigurasi Backend API

```bash
sudo nano /etc/nginx/sites-available/finance-api
```

```nginx
server {
    listen 80;
    server_name api.domain-kamu.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **Catatan:** Jika expose backend via reverse proxy, update `NEXT_PUBLIC_BACKEND_URL` di `.env` ke `https://api.domain-kamu.com`, lalu rebuild dashboard:
> ```bash
> docker compose up -d --build dashboard
> ```
> Dan tambahkan port mapping backend di `docker-compose.yml`:
> ```yaml
> backend:
>   ports:
>     - "3002:3002"
> ```

#### Aktifkan Sites

```bash
sudo ln -s /etc/nginx/sites-available/finance-dashboard /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/finance-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### HTTPS dengan Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d dashboard.domain-kamu.com -d api.domain-kamu.com
```

Certbot otomatis renew via systemd timer.

### Alternatif: Nginx Proxy Manager

Jika lebih suka GUI, gunakan [Nginx Proxy Manager](https://nginxproxymanager.com/):

```bash
# Tambahkan di docker-compose.yml atau jalankan terpisah
docker run -d \
  --name nginx-proxy-manager \
  --restart unless-stopped \
  -p 80:80 -p 443:443 -p 81:81 \
  --network finance-net \
  jc21/nginx-proxy-manager:latest
```

Akses di `http://IP_SERVER:81`, login default: `admin@example.com` / `changeme`.

Buat Proxy Host:
- **dashboard.domain-kamu.com** → `finance-dashboard:3000`
- **api.domain-kamu.com** → `finance-backend:3002`
- Aktifkan SSL dengan Let's Encrypt

---

## Backup Database

### Manual Backup

```bash
docker compose exec postgres pg_dump -U finance_user finance_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore dari Backup

```bash
docker compose exec -T postgres psql -U finance_user finance_db < backup_20250615_120000.sql
```

### Automated Backup (Cron Job)

Buat script backup:

```bash
sudo nano /opt/BotKeuangan/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/BotKeuangan/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Dump database
docker compose -f /opt/BotKeuangan/docker-compose.yml exec -T postgres \
  pg_dump -U finance_user finance_db | gzip > "$BACKUP_DIR/finance_db_$TIMESTAMP.sql.gz"

# Hapus backup lebih dari 30 hari
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup selesai: finance_db_$TIMESTAMP.sql.gz"
```

```bash
chmod +x /opt/BotKeuangan/backup.sh
```

Tambahkan cron job (backup setiap hari jam 3 pagi):

```bash
crontab -e
```

```cron
0 3 * * * /opt/BotKeuangan/backup.sh >> /var/log/finance-backup.log 2>&1
```

---

## Perintah Berguna

```bash
# Lihat status semua service
docker compose ps

# Lihat log service tertentu
docker compose logs -f backend
docker compose logs -f wa-listener

# Restart service tertentu
docker compose restart backend

# Rebuild & restart semua
docker compose up -d --build

# Stop semua service
docker compose down

# Stop dan hapus volume (⚠️ data hilang!)
docker compose down -v

# Masuk ke shell container
docker compose exec backend sh
docker compose exec postgres psql -U finance_user finance_db

# Jalankan migrasi manual
docker compose exec backend node src/migrate.js

# Load seed data
docker compose exec -T postgres psql -U finance_user finance_db < database/migrations/002_seed.sql
```

---

## Struktur Project

```
BotKeuangan/
├── docker-compose.yml          # Orchestrasi semua service
├── .env.example                # Template environment variables
├── README.md                   # Dokumentasi ini
│
├── wa-listener/                # WhatsApp listener (Baileys)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # Entry point
│       ├── config.js           # Env loader
│       ├── socket.js           # Baileys connection + message handler
│       └── server.js           # Internal HTTP server (/internal/send)
│
├── backend/                    # REST API (Express + Gemini)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # Entry point + middleware
│       ├── config.js           # Env loader
│       ├── db.js               # PostgreSQL pool
│       ├── gemini.js           # Gemini AI structured output
│       ├── migrate.js          # Migration runner
│       └── routes/
│           ├── messages.js     # POST /api/messages
│           ├── transactions.js # GET /api/transactions
│           └── summary.js      # GET /api/summary
│
├── database/                   # SQL files
│   └── migrations/
│       ├── 001_init.sql        # Schema + indexes
│       └── 002_seed.sql        # Data dummy untuk testing
│
└── dashboard/                  # Web dashboard (Next.js)
    ├── Dockerfile
    ├── next.config.ts
    ├── package.json
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   └── globals.css
        ├── components/
        │   ├── Dashboard.tsx
        │   ├── SummaryCards.tsx
        │   ├── MonthlyChart.tsx
        │   ├── CategoryPie.tsx
        │   ├── TransactionTable.tsx
        │   └── MonthPicker.tsx
        └── lib/
            ├── api.ts
            ├── types.ts
            └── utils.ts
```

---

## Troubleshooting

| Problem | Solusi |
|---------|--------|
| QR code tidak muncul | `docker compose logs -f wa-listener` — tunggu beberapa detik |
| Harus scan QR ulang setelah restart | Pastikan volume `wa_auth_session` terpasang |
| Backend error 500 | Cek `docker compose logs backend` — biasanya DB belum ready |
| Dashboard kosong | Pastikan `NEXT_PUBLIC_BACKEND_URL` benar dan backend bisa diakses dari browser |
| Gemini error | Cek `GEMINI_API_KEY` valid, cek kuota di [AI Studio](https://aistudio.google.com) |
| Pesan WA tidak diproses | Pastikan `OWNER_WA_NUMBER` sesuai format `628xxx` tanpa `+` |

## Lisensi

Proyek pribadi untuk penggunaan personal.
