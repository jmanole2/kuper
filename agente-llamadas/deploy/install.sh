#!/usr/bin/env bash
# Instala la página de prueba del agente de llamadas en el servidor (Ubuntu 22.04 / 24.04),
# SIN tocar lo que ya corre ahí (agente social, agentes de WhatsApp, otros sitios).
#
# 1) Revisar primero (no cambia nada):
#   curl -fsSL https://raw.githubusercontent.com/jmanole2/novaplastica/claude/youthful-ramanujan-csahjx/agente-llamadas/deploy/install.sh \
#     | sudo REVISAR=1 DOMINIO=llamadas.kuper.media bash
#
# 2) Instalar (la clave de Retell se escribe en el .env del servidor, no se imprime):
#   read -rsp "Clave de Retell: " K; echo
#   curl -fsSL https://raw.githubusercontent.com/jmanole2/novaplastica/claude/youthful-ramanujan-csahjx/agente-llamadas/deploy/install.sh \
#     | sudo DOMINIO=llamadas.kuper.media RETELL_API_KEY="$K" bash
#
# Garantías:
#  - Node 22 propio en /opt/agente-llamadas/node: NO cambia el Node del sistema.
#  - Puerto libre elegido automáticamente (3200-3299), solo accesible desde el propio servidor.
#  - Todo vive en /opt/agente-llamadas, usuario "agente" y servicio "agente-llamadas" (máx. 256 MB de RAM).
#  - nginx: agrega un sitio nuevo solo para DOMINIO; no edita los demás. Valida (nginx -t) antes de recargar.
#  - Si DOMINIO ya responde con otra aplicación, se detiene.
set -euo pipefail

DOMINIO="${DOMINIO:-}"
REVISAR="${REVISAR:-0}"
REPO="${REPO:-https://github.com/jmanole2/novaplastica.git}"
RAMA="${RAMA:-claude/youthful-ramanujan-csahjx}"
NODE_VERSION="${NODE_VERSION:-v22.22.0}"
DIR=/opt/agente-llamadas
APP="$DIR/agente-llamadas"
NODE_DIR="$DIR/node"
EMAIL="${EMAIL:-}"
SERVICIO=agente-llamadas

[ "$(id -u)" = 0 ] || { echo "Córrelo con sudo."; exit 1; }
[ -n "$DOMINIO" ] || { echo "Falta DOMINIO (p. ej. DOMINIO=llamadas.kuper.media)."; exit 1; }

puerto_ocupado() { ss -ltnH "( sport = :$1 )" 2>/dev/null | grep -q .; }
quien_escucha() { ss -ltnpH "( sport = :$1 )" 2>/dev/null | sed -E 's/.*users:\(\("([^"]+)".*/\1/' | head -1; }

if [ -f "$APP/.env" ] && grep -q '^PORT=' "$APP/.env"; then
  PUERTO=$(grep '^PORT=' "$APP/.env" | cut -d= -f2)
else
  PUERTO="${PUERTO:-}"
  if [ -z "$PUERTO" ]; then for p in $(seq 3200 3299); do puerto_ocupado "$p" || { PUERTO=$p; break; }; done; fi
fi

DOMINIO_OCUPADO=0
CODIGO=$(curl -sS4 --max-time 8 -o /dev/null -w '%{http_code}' "https://$DOMINIO/" 2>/dev/null || true)
if [ -n "$CODIGO" ] && [ "$CODIGO" != 000 ]; then
  curl -fsS4 --max-time 8 "https://$DOMINIO/salud" 2>/dev/null | grep -q '"servicio":"agente-llamadas"' || DOMINIO_OCUPADO=1
fi

revisar() {
  echo "================ Revisión del servidor (no se cambió nada) ================"
  . /etc/os-release 2>/dev/null && echo "Sistema:        $PRETTY_NAME"
  echo "RAM:            $(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo) MB (disponible: $(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo) MB)"
  echo "Disco libre:    $(df -h / | awk 'NR==2{print $4}')"
  echo "Web:            nginx=$(systemctl is-active nginx 2>/dev/null || true) caddy=$(systemctl is-active caddy 2>/dev/null || true)"
  echo "Puertos en uso: $(ss -ltnH 2>/dev/null | awk '{print $4}' | sed 's/.*://' | sort -n | uniq | tr '\n' ' ')"
  echo "DNS $DOMINIO:   $(getent hosts "$DOMINIO" | awk '{print $1}' || true)   IP de este servidor: $(curl -fsS4 --max-time 5 https://ifconfig.me 2>/dev/null || echo '?')"
  echo "Puerto para el agente: $PUERTO (libre)"
  [ -d "$DIR" ] && echo "Ya existe una instalación en $DIR (se actualizaría)."
  [ "$DOMINIO_OCUPADO" = 1 ] && echo "OJO: https://$DOMINIO ya responde con OTRA aplicación. Usa otro subdominio."
  echo "============================================================================"
}

revisar
[ "$REVISAR" = 1 ] && exit 0
if [ "$DOMINIO_OCUPADO" = 1 ] && [ "${FORZAR:-0}" != 1 ]; then
  echo "https://$DOMINIO ya lo usa otra aplicación. Para no taparla, me detengo. Usa otro subdominio."
  exit 1
fi
[ -n "$PUERTO" ] || { echo "No encontré un puerto libre entre 3200 y 3299."; exit 1; }
if ! systemctl is-active --quiet nginx && ! systemctl is-active --quiet caddy; then
  for p in 80 443; do
    if puerto_ocupado $p; then echo "El puerto $p lo usa '$(quien_escucha $p)'. No sé cómo agregarme ahí sin riesgo: avísale a Claude con esta salida."; exit 1; fi
  done
fi

echo "==> Paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-upgrade curl git ca-certificates xz-utils

echo "==> Node $NODE_VERSION propio (no toca el Node del sistema)"
case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64|arm64) ARCH=arm64 ;; *) echo "Arquitectura no soportada"; exit 1 ;; esac
if [ ! -x "$NODE_DIR/bin/node" ] || [ "$("$NODE_DIR/bin/node" -v)" != "$NODE_VERSION" ]; then
  mkdir -p "$NODE_DIR"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-$ARCH.tar.xz" | tar -xJ -C "$NODE_DIR" --strip-components=1
fi

echo "==> Usuario y código"
id agente >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin agente
if [ -d "$DIR/.git" ]; then
  chown -R agente:agente "$DIR"
  sudo -u agente git -C "$DIR" fetch --depth 1 origin "$RAMA"
  sudo -u agente git -C "$DIR" checkout -B "$RAMA" "origin/$RAMA"
else
  TMP=$(mktemp -d); git clone --depth 1 --branch "$RAMA" "$REPO" "$TMP/repo"
  mkdir -p "$DIR"; cp -a "$TMP/repo/." "$DIR/"; rm -rf "$TMP"
fi
chown -R agente:agente "$DIR"

echo "==> .env"
if [ ! -f "$APP/.env" ]; then
  cp "$APP/.env.example" "$APP/.env"
  sed -i "s|^PORT=.*|PORT=$PUERTO|" "$APP/.env"
fi
if [ -n "${RETELL_API_KEY:-}" ]; then
  # Se escribe sin pasar por la línea de comandos de sed (no queda en el historial ni en ps).
  grep -v '^RETELL_API_KEY=' "$APP/.env" > "$APP/.env.tmp"
  printf 'RETELL_API_KEY=%s\n' "$RETELL_API_KEY" >> "$APP/.env.tmp"
  mv "$APP/.env.tmp" "$APP/.env"
fi
chown agente:agente "$APP/.env"; chmod 600 "$APP/.env"

COMO_AGENTE="sudo -u agente env PATH=$NODE_DIR/bin:/usr/bin:/bin HOME=/home/agente"
if grep -q '^RETELL_API_KEY=.\+' "$APP/.env"; then
  echo "==> Crear o actualizar el agente en Retell"
  $COMO_AGENTE bash -c "cd '$DIR' && node --env-file='$APP/.env' agente-llamadas/retell.mjs crear" \
    || echo "No se pudo crear el agente en Retell (revisa el mensaje de arriba). La página se instala de todos modos."
fi

echo "==> Servicio $SERVICIO (puerto $PUERTO, solo accesible desde el propio servidor)"
cat > /etc/systemd/system/$SERVICIO.service <<EOF
[Unit]
Description=Agente de llamadas (página de prueba)
After=network-online.target
Wants=network-online.target

[Service]
User=agente
WorkingDirectory=$APP
Environment=PATH=$NODE_DIR/bin:/usr/bin:/bin
Environment=HOST=127.0.0.1
ExecStart=$NODE_DIR/bin/node --env-file=$APP/.env server.mjs
Restart=always
RestartSec=5
MemoryMax=256M

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable $SERVICIO >/dev/null
systemctl restart $SERVICIO

echo "==> https para $DOMINIO"
if systemctl is-active --quiet nginx; then
  SITIO=/etc/nginx/sites-available/$SERVICIO
  [ -f "$SITIO" ] && cp "$SITIO" "$SITIO.bak.$(date +%s)"
  cat > "$SITIO" <<EOF
server {
  listen 80;
  server_name $DOMINIO;
  location / {
    proxy_pass http://127.0.0.1:$PUERTO;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF
  ln -sf "$SITIO" /etc/nginx/sites-enabled/$SERVICIO
  if ! nginx -t; then
    echo "La config nueva de nginx no pasó la validación: la quito y no recargo nada."
    rm -f /etc/nginx/sites-enabled/$SERVICIO; exit 1
  fi
  systemctl reload nginx
  apt-get install -y --no-upgrade certbot python3-certbot-nginx
  if [ -n "$EMAIL" ]; then CORREO=(-m "$EMAIL"); else CORREO=(--register-unsafely-without-email); fi
  certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos "${CORREO[@]}" --redirect
else
  if ! command -v caddy >/dev/null; then
    apt-get install -y --no-upgrade debian-keyring debian-archive-keyring apt-transport-https gnupg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y && apt-get install -y caddy
  fi
  CF=/etc/caddy/Caddyfile
  RESPALDO="$CF.bak.$(date +%s)"
  [ -f "$CF" ] && cp "$CF" "$RESPALDO"
  if ! grep -qs "^$DOMINIO" "$CF"; then
    printf '\n%s {\n  reverse_proxy 127.0.0.1:%s\n}\n' "$DOMINIO" "$PUERTO" >> "$CF"
  fi
  if ! caddy validate --config "$CF" --adapter caddyfile; then
    echo "La config nueva de Caddy no pasó la validación: restauro la anterior y no recargo nada."
    [ -f "$RESPALDO" ] && cp "$RESPALDO" "$CF"
    exit 1
  fi
  # reload no corta las conexiones de los otros sitios; restart solo si reload falla.
  systemctl reload caddy || systemctl restart caddy
fi

if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80/tcp; ufw allow 443/tcp; fi

echo
echo "Listo: https://$DOMINIO"
grep -q '^RETELL_API_KEY=.\+' "$APP/.env" || echo "Falta: poner RETELL_API_KEY en $APP/.env y correr: sudo systemctl restart $SERVICIO"
echo "Actualizar:  sudo bash $APP/deploy/update.sh"
echo "Ver el log:  journalctl -u $SERVICIO -f"
