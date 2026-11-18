#!/usr/bin/env bash
# Respaldo diario de la base de datos (+ fotos) con rotación de 14 días.
# Cron sugerido:  30 3 * * * /ruta/kvibe/bin/backup.sh >> /ruta/kvibe/storage/logs/backup.log 2>&1
# Credenciales: crear ~/.my.cnf con permisos 600:
#   [mysqldump]
#   host=mysql.k-vibe.com.mx   (DreamHost: hostname MySQL del panel)
#   user=kvibe_app
#   password=...
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${KV_DB:-kvibe}"
OUT="$DIR/storage/backups"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$OUT"

mysqldump --single-transaction --quick --routines --default-character-set=utf8mb4 "$DB" | gzip -9 > "$OUT/db-$STAMP.sql.gz"
tar -czf "$OUT/fotos-$STAMP.tar.gz" -C "$DIR/storage/uploads" entries

find "$OUT" -name '*.gz' -mtime +14 -delete
echo "$(date -Iseconds) respaldo OK: db-$STAMP.sql.gz"
