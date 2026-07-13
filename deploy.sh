#!/bin/bash
# ================================================================
# deploy.sh — Deploy BotKeuangan via Docker (Production)
# ================================================================
# Jalankan:
#   chmod +x deploy.sh
#   sudo ./deploy.sh
#
# Opsi:
#   ./deploy.sh              → deploy biasa (HTTP)
#   ./deploy.sh --ssl        → deploy + setup SSL (butuh domain)
#   ./deploy.sh --update     → update (rebuild & restart)
#   ./deploy.sh --backup     → backup database
#   ./deploy.sh --restore    → restore database dari file
# ================================================================

set -euo pipefail

# ── WARNA ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

print_step()  { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${GREEN}✅ $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
print_warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }

# ── Detect project directory ───────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Parse arguments ────────────────────────────────────
ACTION="deploy"
for arg in "$@"; do
  case $arg in
    --ssl)    ACTION="ssl" ;;
    --update) ACTION="update" ;;
    --backup) ACTION="backup" ;;
    --restore) ACTION="restore" ;;
    --help|-h) ACTION="help" ;;
  esac
done

# ── Help ───────────────────────────────────────────────
if [ "$ACTION" = "help" ]; then
  echo ""
  echo -e "${BOLD}BotKeuangan — Docker Deploy Script${NC}"
  echo ""
  echo "Usage:"
  echo "  ./deploy.sh              Deploy (HTTP mode)"
  echo "  ./deploy.sh --ssl        Deploy + Setup SSL certificate"
  echo "  ./deploy.sh --update     Rebuild & restart semua service"
  echo "  ./deploy.sh --backup     Backup database"
  echo "  ./deploy.sh --restore    Restore database"
  echo "  ./deploy.sh --help       Tampilkan help ini"
  echo ""
  exit 0
fi

# ── Cek Docker ─────────────────────────────────────────
check_docker() {
  if ! command -v docker &> /dev/null; then
    print_error "Docker belum terinstall!"
    echo ""
    echo "Install Docker:"
    echo "  curl -fsSL https://get.docker.com | sh"
    echo "  sudo usermod -aG docker \$USER"
    echo "  # Logout & login ulang"
    exit 1
  fi

  if ! docker compose version &> /dev/null; then
    print_error "Docker Compose plugin belum terinstall!"
    echo "  sudo apt install docker-compose-plugin -y"
    exit 1
  fi

  print_info "Docker: $(docker --version | awk '{print $3}')"
  print_info "Compose: $(docker compose version --short)"
}

# ── Cek .env ──────────────────────────────────────────
check_env() {
  if [ ! -f ".env" ]; then
    print_error "File .env belum ada!"
    echo ""
    echo "Jalankan:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
  fi

  # Load .env
  set -a
  source .env
  set +a

  # Validasi
  local errors=0

  if [ -z "${POSTGRES_PASSWORD:-}" ] || [ "${POSTGRES_PASSWORD}" = "ganti_password_ini_yang_kuat" ]; then
    print_error "POSTGRES_PASSWORD belum diganti di .env!"
    errors=$((errors + 1))
  fi

  if [ -z "${GEMINI_API_KEY:-}" ] || [ "${GEMINI_API_KEY}" = "your_gemini_api_key_here" ]; then
    print_error "GEMINI_API_KEY belum diisi di .env!"
    errors=$((errors + 1))
  fi

  if [ -z "${OWNER_WA_NUMBER:-}" ] || [ "${OWNER_WA_NUMBER}" = "628123456789" ]; then
    print_error "OWNER_WA_NUMBER belum diganti di .env!"
    errors=$((errors + 1))
  fi

  if [ $errors -gt 0 ]; then
    echo ""
    echo "Edit file .env terlebih dahulu: nano .env"
    exit 1
  fi

  print_info "Environment variables OK"
}

# ── Setup Firewall ────────────────────────────────────
setup_firewall() {
  if command -v ufw &> /dev/null; then
    print_info "Setting up firewall (ufw)..."
    ufw allow 22/tcp  > /dev/null 2>&1 || true
    ufw allow 80/tcp  > /dev/null 2>&1 || true
    ufw allow 443/tcp > /dev/null 2>&1 || true
    echo "y" | ufw enable > /dev/null 2>&1 || true
    print_info "Firewall: SSH(22), HTTP(80), HTTPS(443) allowed"
  fi
}

# ── Deploy ─────────────────────────────────────────────
do_deploy() {
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║     BotKeuangan — Docker Production Deploy   ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
  echo ""

  check_docker
  check_env

  print_step "Tahap 1/4: Pull base images"
  docker compose pull postgres 2>/dev/null || true

  print_step "Tahap 2/4: Build & Start semua service"
  docker compose up -d --build --remove-orphans

  print_step "Tahap 3/4: Menunggu service healthy..."
  echo "Menunggu PostgreSQL ready..."
  
  local retries=30
  while [ $retries -gt 0 ]; do
    if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-finance_user}" &>/dev/null; then
      echo "PostgreSQL ready!"
      break
    fi
    retries=$((retries - 1))
    sleep 2
  done

  if [ $retries -eq 0 ]; then
    print_warn "PostgreSQL belum ready setelah 60 detik, tapi mungkin masih starting..."
  fi

  # Tunggu backend ready
  echo "Menunggu Backend ready..."
  retries=20
  while [ $retries -gt 0 ]; do
    if docker compose exec -T backend curl -sf http://localhost:3002/health &>/dev/null; then
      echo "Backend ready!"
      break
    fi
    retries=$((retries - 1))
    sleep 3
  done

  print_step "Tahap 4/4: Setup firewall"
  setup_firewall

  # ── Setup auto-backup cron ────────────────────────
  if command -v crontab &> /dev/null; then
    BACKUP_CMD="0 3 * * * cd $SCRIPT_DIR && ./backup.sh >> /var/log/finance-backup.log 2>&1"
    (crontab -l 2>/dev/null | grep -v "finance-backup\|backup.sh"; echo "$BACKUP_CMD") | crontab - 2>/dev/null || true
    print_info "Auto-backup cron: setiap hari jam 03:00"
  fi

  # ── Done ──────────────────────────────────────────
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║              🎉 DEPLOY BERHASIL! 🎉                  ║${NC}"
  echo -e "${GREEN}╠═══════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║                                                       ║${NC}"

  local domain="${DOMAIN:-localhost}"
  local api_domain="${API_DOMAIN:-api.localhost}"

  if [ "$domain" = "localhost" ]; then
    echo -e "${GREEN}║  Dashboard : http://localhost                         ║${NC}"
    echo -e "${GREEN}║  API       : http://localhost:3002                    ║${NC}"
  else
    echo -e "${GREEN}║  Dashboard : https://${domain}                        ║${NC}"
    echo -e "${GREEN}║  API       : https://${api_domain}                    ║${NC}"
  fi

  echo -e "${GREEN}║                                                       ║${NC}"
  echo -e "${GREEN}║  📌 LANGKAH SELANJUTNYA:                              ║${NC}"
  echo -e "${GREEN}║                                                       ║${NC}"
  echo -e "${GREEN}║  1. Scan QR WhatsApp:                                 ║${NC}"
  echo -e "${GREEN}║     docker compose logs -f wa-listener                ║${NC}"
  echo -e "${GREEN}║                                                       ║${NC}"
  echo -e "${GREEN}║  2. (Opsional) Setup SSL:                             ║${NC}"
  echo -e "${GREEN}║     ./deploy.sh --ssl                                 ║${NC}"
  echo -e "${GREEN}║                                                       ║${NC}"
  echo -e "${GREEN}║  📊 Perintah berguna:                                 ║${NC}"
  echo -e "${GREEN}║     make status    — cek status service               ║${NC}"
  echo -e "${GREEN}║     make logs      — lihat semua log                  ║${NC}"
  echo -e "${GREEN}║     make restart   — restart semua                    ║${NC}"
  echo -e "${GREEN}║     make backup    — backup database                  ║${NC}"
  echo -e "${GREEN}║                                                       ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
  echo ""

  docker compose ps
}

# ── Update ─────────────────────────────────────────────
do_update() {
  print_step "Update: Rebuild & Restart"
  check_docker
  check_env

  echo "Pulling latest base images..."
  docker compose pull postgres 2>/dev/null || true

  echo "Rebuilding & restarting..."
  docker compose up -d --build --remove-orphans

  echo ""
  print_info "Update selesai!"
  docker compose ps
}

# ── SSL Setup ──────────────────────────────────────────
do_ssl() {
  print_step "Setup SSL Certificate (Let's Encrypt)"
  check_docker
  check_env

  local domain="${DOMAIN:-localhost}"
  local api_domain="${API_DOMAIN:-api.localhost}"

  if [ "$domain" = "localhost" ] || [ "$api_domain" = "api.localhost" ]; then
    print_error "Untuk SSL, set DOMAIN dan API_DOMAIN di .env ke domain yang valid!"
    echo "Contoh:"
    echo "  DOMAIN=finance-bot.domain-kamu.com"
    echo "  API_DOMAIN=api.finance-bot.domain-kamu.com"
    exit 1
  fi

  echo "Domain    : $domain"
  echo "API Domain: $api_domain"
  echo ""

  # Backup current config
  print_info "Backup Nginx config lama..."
  cp nginx/conf.d/default.conf.template nginx/conf.d/default.conf.template.bak 2>/dev/null || true

  # Request certificate (need HTTP server running first for webroot challenge)
  print_info "Requesting SSL certificate..."
  docker compose --profile ssl run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "admin@${domain}" \
    --agree-tos \
    --no-eff-email \
    -d "$domain" \
    -d "$api_domain"

  # Switch to SSL config
  print_info "Switching Nginx config ke SSL mode..."
  cp nginx/ssl.conf.template nginx/conf.d/default.conf.template
  
  # Reload nginx
  docker compose restart nginx

  # Setup auto-renewal cron
  RENEW_CMD="0 0 */60 * * cd $SCRIPT_DIR && docker compose --profile ssl run --rm certbot renew && docker compose exec nginx nginx -s reload"
  (crontab -l 2>/dev/null | grep -v "certbot"; echo "$RENEW_CMD") | crontab - 2>/dev/null || true

  echo ""
  print_info "SSL berhasil! Certificate akan auto-renew setiap 60 hari."
  print_info "Dashboard: https://${domain}"
  print_info "API      : https://${api_domain}"
}

# ── Backup ─────────────────────────────────────────────
do_backup() {
  if [ -x "./backup.sh" ]; then
    ./backup.sh
  else
    print_error "backup.sh tidak ditemukan atau tidak executable"
    print_info "Jalankan: chmod +x backup.sh"
    exit 1
  fi
}

# ── Restore ────────────────────────────────────────────
do_restore() {
  check_docker

  local backup_dir="./backups"
  if [ ! -d "$backup_dir" ]; then
    print_error "Folder backups/ tidak ditemukan"
    exit 1
  fi

  echo "Backup files yang tersedia:"
  echo ""
  ls -1t "$backup_dir"/*.sql.gz 2>/dev/null || { print_error "Tidak ada file backup"; exit 1; }
  echo ""
  read -p "Masukkan nama file backup (contoh: finance_db_20250615_030000.sql.gz): " backup_file

  if [ ! -f "$backup_dir/$backup_file" ]; then
    print_error "File tidak ditemukan: $backup_dir/$backup_file"
    exit 1
  fi

  echo ""
  print_warn "PERHATIAN: Ini akan menimpa semua data di database!"
  read -p "Lanjutkan? (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Dibatalkan."
    exit 0
  fi

  set -a; source .env; set +a

  print_info "Restoring dari $backup_file..."
  gunzip -c "$backup_dir/$backup_file" | docker compose exec -T postgres psql -U "${POSTGRES_USER:-finance_user}" -d "${POSTGRES_DB:-finance_db}"

  print_info "Restore selesai!"
}

# ── Execute action ─────────────────────────────────────
case "$ACTION" in
  deploy)  do_deploy  ;;
  update)  do_update  ;;
  ssl)     do_ssl     ;;
  backup)  do_backup  ;;
  restore) do_restore ;;
esac
