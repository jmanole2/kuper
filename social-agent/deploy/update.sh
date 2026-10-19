#!/usr/bin/env bash
# Actualiza el agente en el servidor a lo último de la rama y lo reinicia.
#   sudo bash /opt/agente-social/social-agent/deploy/update.sh
set -euo pipefail
DIR=/opt/agente-social
RAMA="${RAMA:-agente-publicador-redes-sociales}"
git -C "$DIR" fetch --depth 1 origin "$RAMA"
git -C "$DIR" checkout -B "$RAMA" "origin/$RAMA"
chown -R agente:agente "$DIR"
sudo -u agente env PATH="$DIR/node/bin:/usr/bin:/bin" HOME=/home/agente bash -c "cd '$DIR/social-agent' && npm ci --omit=dev"
systemctl restart agente-social
systemctl --no-pager status agente-social | head -5
