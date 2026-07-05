#!/bin/bash
# ================================================================
# deploy-native.sh — Deploy BotKeuangan tanpa Docker
# ================================================================
# Jalankan sebagai root:
#   chmod +x deploy-native.sh
#   ./deploy-native.sh
# ================================================================

set -e

# ── WARNA ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${GREEN}✅ $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
print_warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# ── CEK ROOT ───────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  print_error "Jalankan script ini sebagai root: sudo ./deploy-native.sh"
  exit 1
fi

# ── KONFIGURASI ────────────────────────────────────────
PROJECT_DIR="/var/www/finance-bot"
DOMAIN="finance-bot.afiefnoer.my.id"
API_DOMAIN="api.finance-bot.afiefnoer.my.id"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   BotKeuangan — Deploy Native (Tanpa Docker)  ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Dashboard : ${DOMAIN}        ║${NC}"
echo -e "${GREEN}║  API       : ${API_DOMAIN}    ║${NC}"
echo -e "${GREEN}║  Project   : ${PROJECT_DIR}              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── CEK .env ───────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/.env" ]; then
  print_error "File .env belum ada! Jalankan dulu:"
  echo "  cp $PROJECT_DIR/.env.example $PROJECT_DIR/.env"
  echo "  nano $PROJECT_DIR/.env"
  exit 1
fi

# Load .env
set -a
source "$PROJECT_DIR/.env"
set +a

# Validasi env
if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "ganti_password_ini_yang_kuat" ]; then
  print_error "POSTGRES_PASSWORD belum diganti di .env!"
  exit 1
fi
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
  print_error "GEMINI_API_KEY belum diisi di .env!"
  exit 1
fi
if [ -z "$OWNER_WA_NUMBER" ] || [ "$OWNER_WA_NUMBER" = "628123456789" ]; then
  print_error "OWNER_WA_NUMBER belum diganti di .env!"
  exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAHAP 1: Update System & Install Dependencies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print_step "Tahap 1/8: Update System & Install Dependencies Dasar"

apt-get update
apt-get install -y curl git nano build-essential ufw gnupg2 lsb-release ca-certificates

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAHAP 2: Install PostgreSQL 16
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print_step "Tahap 2/8: Install PostgreSQL 16"

if ! command -v psql &> /dev/null; then
  echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  apt-get update
  apt-get install -y postgresql-16
else
  echo "PostgreSQL sudah terinstall, skip..."
fi

systemctl enable postgresql
systemctl start postgresql

# Buat user & database (skip jika sudah ada)
echo "Membuat database & user..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER:-finance_user}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${POSTGRES_USER:-finance_user} WITH PASSWORD '${POSTGRES_PASSWORD}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB:-finance_db}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${POSTGRES_DB:-finance_db} OWNER ${POSTGRES_USER:-finance_user};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB:-finance_db} TO ${POSTGRES_USER:-finance_user};"

# Jalankan migration
echo "Menjalankan migration..."
sudo -u postgres psql -d "${POSTGRES_DB:-finance_db}" < "$PROJECT_DIR/database/migrations/001_init.sql"

# Set permissions
sudo -u postgres psql -d "${POSTGRES_DB:-finance_db}" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${POSTGRES_USER:-finance_user};"
sudo -u postgres psql -d "${POSTGRES_DB:-finance_db}" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${POSTGRES_USER:-finance_user};"
sudo -u postgres psql -d "${POSTGRES_DB:-finance_db}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${POSTGRES_USER:-finance_user};"
sudo -u postgres psql -d "${POSTGRES_DB:-finance_db}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${POSTGRES_USER:-finance_user};"

# Konfigurasi pg_hba.conf supaya bisa login pakai password dari localhost
PG_HBA=$(find /etc/postgresql -name pg_hba.conf | head -1)
if [ -n "$PG_HBA" ]; then
  # Tambah rule md5 untuk local connection jika belum ada
  if ! grep -q "local.*all.*${POSTGRES_USER:-finance_user}.*md5" "$PG_HBA"; then
    # Tambah sebelum baris "local all all peer"
    sed -i "/^local\s\+all\s\+all\s\+peer/i local   all   ${POSTGRES_USER:-finance_user}   md5" "$PG_HBA"
    systemctl restart postgresql
    echo "pg_hba.conf updated untuk allow md5 auth"
  fi
fi

echo "✅ PostgreSQL siap!"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAHAP 3: Install Node.js 20
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print_step "Tahap 3/8: Install Node.js 20"

if ! command -v node &> /dev/null || [[ ! "$(node -v)" =~ ^v20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "Node.js 20 sudah terinstall, skip..."
fi

echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAHAP 4: Install PM2
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print_step "Tahap 4/8: Install PM2"

if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
else
  echo "PM2 sudah terinstall, skip..."
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAHAP 5: Install NPM Dependencies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print_step "Tahap 5/8: Install NPM Dependencies untuk semua service"

echo "→ Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
npm install --omit=dev

echo "→ Installing wa-listener dependencies..."
cd "$PROJECT_DIR/wa-listener"
npm install --omit=dev

echo "→ Installing dashboard dependencies..."
cd "$PROJECT_DIR/dashboard"
npm install

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAHAP 6: Build Dashboard (Next.js)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print_step "Tahap 6/8: Build Dashboard Next.js"

cd "$PROJECT_DIR/dashboard"

export NEXT_PUBLIC_BACKEND_URL="https://${API_DOMAIN}"
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="--max-old-space-size=1024"

echo "Building dengan NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}"
npm run build

# Copy static files ke standalone (Next.js standalone butuh ini)
if [ -d ".next/standalone" ]; then
  cp -r public .next/standalone/ 2>/dev/null || true
  cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
  echo "✅ Static files copied ke standalone"
else
  print_error "Build gagal — folder .next/standalone tidak ditemukan!"
  exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAHAP 7: Update ecosystem.config.cjs dengan nilai dari .env
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print_step "Tahap 7/8: Start Semua Service dengan PM2"

cd "$PROJECT_DIR"

# Stop PM2 apps yang sudah jalan (jika ada)
pm2 delete all 2>/dev/null || true

# Set env variables supaya ecosystem.config.cjs bisa baca
export POSTGRES_USER="${POSTGRES_USER:-finance_user}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
export POSTGRES_DB="${POSTGRES_DB:-finance_db}"
export GEMINI_API_KEY="${GEMINI_API_KEY}"
export OWNER_WA_NUMBER="${OWNER_WA_NUMBER}"

# Start semua service
pm2 start ecosystem.config.cjs

# Simpan config PM2 supaya auto-start saat reboot
pm2 save

# Setup startup script
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup

echo ""
pm2 status
echo ""
echo "✅ Semua service jalan!"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAHAP 8: Setup Nginx Reverse Proxy
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print_step "Tahap 8/8: Setup Nginx Reverse Proxy"

if ! command -v nginx &> /dev/null; then
  apt-get install -y nginx
fi

# Dashboard config
cat > /etc/nginx/sites-available/finance-dashboard << 'NGINX_DASHBOARD'
server {
    listen 80;
    server_name finance-bot.afiefnoer.my.id;

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
NGINX_DASHBOARD

# API config
cat > /etc/nginx/sites-available/finance-api << 'NGINX_API'
server {
    listen 80;
    server_name api.finance-bot.afiefnoer.my.id;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_API

# Enable sites
ln -sf /etc/nginx/sites-available/finance-dashboard /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/finance-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test & reload
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "✅ Nginx siap!"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SETUP BACKUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "Setting up auto-backup..."

mkdir -p "$PROJECT_DIR/backups"

cat > "$PROJECT_DIR/backup.sh" << 'BACKUP_SCRIPT'
#!/bin/bash
BACKUP_DIR="/var/www/finance-bot/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
pg_dump -U finance_user -h localhost finance_db 2>/dev/null | gzip > "$BACKUP_DIR/finance_db_$TIMESTAMP.sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "[$TIMESTAMP] Backup selesai"
BACKUP_SCRIPT

chmod +x "$PROJECT_DIR/backup.sh"

# Cron: backup setiap hari jam 3 pagi
(crontab -l 2>/dev/null | grep -v finance-bot; echo "0 3 * * * $PROJECT_DIR/backup.sh >> /var/log/finance-backup.log 2>&1") | crontab -

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SETUP FIREWALL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "Setting up firewall..."

ufw allow 22/tcp >/dev/null 2>&1
ufw allow 80/tcp >/dev/null 2>&1
ufw allow 443/tcp >/dev/null 2>&1
echo "y" | ufw enable >/dev/null 2>&1

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SELESAI!
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          🎉 DEPLOY BERHASIL! 🎉                      ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}║  Dashboard : http://${DOMAIN}       ║${NC}"
echo -e "${GREEN}║  API       : http://${API_DOMAIN}   ║${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}║  📌 LANGKAH SELANJUTNYA:                              ║${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}║  1. Setup DNS A record:                               ║${NC}"
echo -e "${GREEN}║     ${DOMAIN}     → IP server              ║${NC}"
echo -e "${GREEN}║     ${API_DOMAIN} → IP server              ║${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}║  2. Setelah DNS propagasi, install SSL:               ║${NC}"
echo -e "${GREEN}║     apt install certbot python3-certbot-nginx -y      ║${NC}"
echo -e "${GREEN}║     certbot --nginx \\                                 ║${NC}"
echo -e "${GREEN}║       -d ${DOMAIN} \\                       ║${NC}"
echo -e "${GREEN}║       -d ${API_DOMAIN}                     ║${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}║  3. Scan QR WhatsApp:                                 ║${NC}"
echo -e "${GREEN}║     pm2 logs finance-wa-listener                      ║${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}║  📊 Perintah berguna:                                 ║${NC}"
echo -e "${GREEN}║     pm2 status        — cek status service            ║${NC}"
echo -e "${GREEN}║     pm2 logs          — lihat semua log               ║${NC}"
echo -e "${GREEN}║     pm2 restart all   — restart semua                 ║${NC}"
echo -e "${GREEN}║     pm2 monit         — monitor realtime              ║${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# IP server
echo -e "IP Server: $(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo ""

# Status PM2
pm2 status
