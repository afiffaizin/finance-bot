#!/bin/bash
# ================================================================
# backup.sh — Backup database BotKeuangan (Docker)
# ================================================================
# Usage:
#   chmod +x backup.sh
#   ./backup.sh
# ================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKUP_DIR="$SCRIPT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="finance_db_${TIMESTAMP}.sql.gz"
KEEP_DAYS=30

# Load .env
if [ -f ".env" ]; then
  set -a; source .env; set +a
fi

DB_USER="${POSTGRES_USER:-finance_user}"
DB_NAME="${POSTGRES_DB:-finance_db}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if postgres container is running
if ! docker compose ps postgres --status running 2>/dev/null | grep -q "running"; then
  echo "[$TIMESTAMP] ERROR: Container postgres tidak running"
  exit 1
fi

# Dump database
echo "[$TIMESTAMP] Memulai backup..."
docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists 2>/dev/null \
  | gzip > "$BACKUP_DIR/$BACKUP_FILE"

# Verify backup
FILESIZE=$(stat -f%z "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null || echo "0")

if [ "$FILESIZE" -gt 0 ]; then
  echo "[$TIMESTAMP] ✅ Backup berhasil: $BACKUP_FILE ($(numfmt --to=iec "$FILESIZE" 2>/dev/null || echo "${FILESIZE} bytes"))"
else
  echo "[$TIMESTAMP] ❌ Backup gagal — file kosong!"
  rm -f "$BACKUP_DIR/$BACKUP_FILE"
  exit 1
fi

# Cleanup old backups
DELETED=$(find "$BACKUP_DIR" -name "finance_db_*.sql.gz" -mtime +${KEEP_DAYS} -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$TIMESTAMP] 🗑️  Menghapus $DELETED backup lama (>${KEEP_DAYS} hari)"
fi

echo "[$TIMESTAMP] Backup selesai"
