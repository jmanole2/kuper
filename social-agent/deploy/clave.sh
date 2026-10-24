#!/usr/bin/env bash
# Guarda una clave en el .env del panel sin mostrarla en pantalla, y reinicia el panel.
#   sudo bash /opt/agente-social/social-agent/deploy/clave.sh GEMINI_TEXT_API_KEY
set -euo pipefail
F=/opt/agente-social/social-agent/.env; N="${1:-}"
[ "$(id -u)" = 0 ] || { echo "Córrelo con sudo."; exit 1; }
[[ "$N" =~ ^[A-Z][A-Z0-9_]+$ ]] || { echo "Uso: sudo bash $0 NOMBRE_DE_LA_CLAVE"; exit 1; }
read -rsp "Pega el valor de $N (no se ve) y Enter: " V; echo
# Quita lo que agrega la terminal al pegar (^[[200~ ... ^[[201~), saltos de línea, espacios y comillas.
V=$(printf '%s' "$V" | sed -E $'s/\x1b\\[20[01]~//g; s/\\[20[01]~//g' | tr -d '\r\n\t "'"'"'' | tr -cd '[:print:]')
[ -n "$V" ] || { echo "Vacío: no cambié nada."; exit 1; }
grep -v "^$N=" "$F" > "$F.tmp" || true
printf '%s=%s\n' "$N" "$V" >> "$F.tmp"
mv "$F.tmp" "$F"; chown agente:agente "$F"; chmod 600 "$F"
systemctl restart agente-social
echo "$N guardada (${#V} caracteres) y panel reiniciado."
