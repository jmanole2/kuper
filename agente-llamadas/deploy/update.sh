#!/usr/bin/env bash
# Actualiza el agente de llamadas a lo último de la rama, actualiza el agente en Retell y reinicia.
#   sudo bash /opt/agente-llamadas/agente-llamadas/deploy/update.sh
set -euo pipefail
DIR=/opt/agente-llamadas
APP="$DIR/agente-llamadas"
RAMA="${RAMA:-claude/youthful-ramanujan-csahjx}"
chown -R agente:agente "$DIR"
sudo -u agente git -C "$DIR" fetch --depth 1 origin "$RAMA"
sudo -u agente git -C "$DIR" checkout -B "$RAMA" "origin/$RAMA"
if grep -q '^RETELL_API_KEY=.\+' "$APP/.env"; then
  sudo -u agente env PATH="$DIR/node/bin:/usr/bin:/bin" HOME=/home/agente \
    bash -c "cd '$DIR' && node --env-file='$APP/.env' agente-llamadas/retell.mjs crear" || true
fi
systemctl restart agente-llamadas
systemctl --no-pager status agente-llamadas | head -5
