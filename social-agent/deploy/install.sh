#!/usr/bin/env bash
# Instala el agente social en un servidor Ubuntu (22.04 / 24.04), p. ej. un droplet de DigitalOcean,
# SIN tocar lo que ya corre ahí (otros agentes, sitios, versiones de Node).
#
# 1) Revisar primero (no cambia nada, solo muestra qué hay en el servidor):
#   curl -fsSL https://raw.githubusercontent.com/jmanole2/novaplastica/agente-publicador-redes-sociales/social-agent/deploy/install.sh \
#     | sudo REVISAR=1 DOMINIO=redes.kuper.media bash
#
# 2) Instalar:
#   curl -fsSL https://raw.githubusercontent.com/jmanole2/novaplastica/agente-publicador-redes-sociales/social-agent/deploy/install.sh \
#     | sudo DOMINIO=redes.kuper.media bash
#
# Garantías:
#  - Node 22 propio en /opt/agente-social/node: NO cambia el Node del sistema que usen otros agentes.
#  - Puerto libre elegido automáticamente (3100-3199): no choca con otros servicios.
#  - Todo vive en /opt/agente-social, usuario "agente" y servicio "agente-social".
#  - nginx: agrega un sitio nuevo solo para DOMINIO; no edita los demás. Respaldo y validación (nginx -t)
#    antes de recargar; si la validación falla, se revierte.
#  - Solo instala paquetes del sistema (librerías de Chromium, certbot); no desinstala ni actualiza nada más.
set -euo pipefail

DOMINIO="${DOMINIO:-}"
REVISAR="${REVISAR:-0}"
REPO="${REPO:-https://github.com/jmanole2/novaplastica.git}"
RAMA="${RAMA:-agente-publicador-redes-sociales}"
NODE_VERSION="${NODE_VERSION:-v22.22.0}"
DIR=/opt/agente-social
APP="$DIR/social-agent"
NODE_DIR="$DIR/node"
EMAIL="${EMAIL:-}"

[ "$(id -u)" = 0 ] || { echo "Córrelo con sudo."; exit 1; }
[ -n "$DOMINIO" ] || { echo "Falta DOMINIO (p. ej. DOMINIO=redes.kuper.media)."; exit 1; }

puerto_ocupado() { ss -ltnH "( sport = :$1 )" 2>/dev/null | grep -q .; }
quien_escucha() { ss -ltnpH "( sport = :$1 )" 2>/dev/null | sed -E 's/.*users:\(\("([^"]+)".*/\1/' | head -1; }

# Puerto: el del .env si ya existe una instalación; si no, el primero libre entre 3100 y 3199.
if [ -f "$APP/.env" ] && grep -q '^PORT=' "$APP/.env"; then
  PUERTO=$(grep '^PORT=' "$APP/.env" | cut -d= -f2)
else
  PUERTO="${PUERTO:-}"
  if [ -z "$PUERTO" ]; then for p in $(seq 3100 3199); do puerto_ocupado "$p" || { PUERTO=$p; break; }; done; fi
fi

# ---------------------------------------------------------------- revisión (no cambia nada)
revisar() {
  echo "================ Revisión del servidor (no se cambió nada) ================"
  . /etc/os-release 2>/dev/null && echo "Sistema:        $PRETTY_NAME"
  echo "RAM:            $(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo) MB   swap: $(free -m | awk '/Swap/{print $2}') MB"
  echo "Disco libre:    $(df -h / | awk 'NR==2{print $4}')"
  echo "Node sistema:   $(command -v node >/dev/null && node -v || echo 'no instalado') (no se toca)"
  command -v pm2 >/dev/null && echo "PM2:            sí ($(pm2 jlist 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | tr '\n' ' '))"
  echo "Web:            nginx=$(systemctl is-active nginx 2>/dev/null || true) caddy=$(systemctl is-active caddy 2>/dev/null || true) apache=$(systemctl is-active apache2 2>/dev/null || true)"
  echo "Puertos en uso: $(ss -ltnpH 2>/dev/null | awk '{print $4}' | sed 's/.*://' | sort -n | uniq | tr '\n' ' ')"
  for p in 80 443; do puerto_ocupado $p && echo "  puerto $p: $(quien_escucha $p)"; done
  echo "Servicios:      $(systemctl list-units --type=service --state=running --no-legend 2>/dev/null | awk '{print $1}' | grep -vE '^(systemd|dbus|ssh|cron|rsyslog|snapd|polkit|udisks|unattended|getty|serial|networkd|multipathd|ModemManager|qemu|droplet|do-agent|irqbalance|user@|uuidd|packagekit|fwupd|accounts|ufw|chrony|atd|lvm|blk|apport|cloud)' | tr '\n' ' ')"
  if systemctl is-active --quiet nginx; then
    echo "Sitios nginx:   $(ls /etc/nginx/sites-enabled 2>/dev/null | tr '\n' ' ')"
    grep -rqsw "server_name.*$DOMINIO" /etc/nginx/sites-enabled /etc/nginx/conf.d && echo "  OJO: $DOMINIO ya aparece en la config de nginx."
  fi
  echo "DNS $DOMINIO:   $(getent hosts "$DOMINIO" | awk '{print $1}' || true)   IP de este servidor: $(curl -fsS4 --max-time 5 https://ifconfig.me 2>/dev/null || echo '?')"
  echo "Puerto para el agente: $PUERTO (libre)"
  [ -d "$DIR" ] && echo "Ya existe una instalación en $DIR (se actualizaría)."
  echo "============================================================================"
}

# ¿El dominio ya lo usa otra aplicación? (p. ej. otro agente). Entonces no se instala ahí.
DOMINIO_OCUPADO=0
if curl -fsS4 --max-time 8 -o /dev/null "https://$DOMINIO/" 2>/dev/null || curl -sS4 --max-time 8 -o /dev/null -w '%{http_code}' "https://$DOMINIO/" 2>/dev/null | grep -qvE '^(000)$'; then
  curl -fsS4 --max-time 8 "https://$DOMINIO/salud" 2>/dev/null | grep -q '"ok":true' || DOMINIO_OCUPADO=1
fi

if [ "$REVISAR" = 1 ]; then
  revisar
  [ "$DOMINIO_OCUPADO" = 1 ] && echo "OJO: https://$DOMINIO ya responde con OTRA aplicación. Usa otro subdominio para el agente."
  exit 0
fi
revisar
if [ "$DOMINIO_OCUPADO" = 1 ] && [ "${FORZAR:-0}" != 1 ]; then
  echo "https://$DOMINIO ya responde con otra aplicación (¿otro agente?). Para no tapar nada, me detengo."
  echo "Usa otro subdominio (p. ej. DOMINIO=redes.kuper.media)."
  exit 1
fi

[ -n "$PUERTO" ] || { echo "No encontré un puerto libre entre 3100 y 3199."; exit 1; }
if ! systemctl is-active --quiet nginx && ! systemctl is-active --quiet caddy; then
  for p in 80 443; do
    if puerto_ocupado $p; then echo "El puerto $p lo usa '$(quien_escucha $p)'. No sé cómo agregarme ahí sin riesgo: avísale a Claude con esta salida."; exit 1; fi
  done
fi

# ---------------------------------------------------------------- swap (solo si hace falta)
RAM_MB=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
if [ "$RAM_MB" -lt 1900 ] && ! swapon --show | grep -q .; then
  echo "==> ${RAM_MB} MB de RAM: creando 2 GB de swap (colchón para los renders de video)"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null && echo 'vm.swappiness=10' > /etc/sysctl.d/99-agente-swap.conf
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
export PATH="$NODE_DIR/bin:$PATH"

echo "==> Usuario y código"
id agente >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin agente
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --depth 1 origin "$RAMA" && git -C "$DIR" checkout -B "$RAMA" "origin/$RAMA"
else
  TMP=$(mktemp -d); git clone --depth 1 --branch "$RAMA" "$REPO" "$TMP/repo"
  mkdir -p "$DIR"; cp -a "$TMP/repo/." "$DIR/"; rm -rf "$TMP"
fi
chown -R agente:agente "$DIR"

echo "==> Dependencias (npm + Chromium)"
AS_AGENTE="sudo -u agente env PATH=$NODE_DIR/bin:/usr/bin:/bin HOME=/home/agente"
$AS_AGENTE bash -c "cd '$APP' && npm ci --omit=dev"
(cd "$APP" && "$NODE_DIR/bin/npx" playwright install-deps chromium)   # solo agrega librerías del sistema
$AS_AGENTE bash -c "cd '$APP' && npx playwright install chromium"

echo "==> .env"
if [ ! -f "$APP/.env" ]; then
  ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  cp "$APP/.env.example" "$APP/.env"
  sed -i "s|^PORT=.*|PORT=$PUERTO|; s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://$DOMINIO|; s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PASS|; s|^SECRET_KEY=.*|SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')|" "$APP/.env"
  chown agente:agente "$APP/.env"; chmod 600 "$APP/.env"
  NUEVO_ENV=1
fi

echo "==> Servicio agente-social (puerto $PUERTO, solo accesible desde el propio servidor)"
cat > /etc/systemd/system/agente-social.service <<EOF
[Unit]
Description=Agente publicador de redes sociales
After=network-online.target
Wants=network-online.target

[Service]
User=agente
WorkingDirectory=$APP
Environment=PATH=$NODE_DIR/bin:/usr/bin:/bin
Environment=HOST=127.0.0.1
ExecStart=$NODE_DIR/bin/node --no-warnings=ExperimentalWarning --env-file=$APP/.env src/server.js
Restart=always
RestartSec=5
# Límite de memoria: si un render se pasa, se reinicia este servicio y no afecta a los demás.
MemoryMax=1500M
Nice=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable agente-social >/dev/null
systemctl restart agente-social

echo "==> https para $DOMINIO"
if systemctl is-active --quiet nginx; then
  SITIO=/etc/nginx/sites-available/agente-social
  [ -f "$SITIO" ] && cp "$SITIO" "$SITIO.bak.$(date +%s)"
  cat > "$SITIO" <<EOF
server {
  listen 80;
  server_name $DOMINIO;
  client_max_body_size 300m;
  location / {
    proxy_pass http://127.0.0.1:$PUERTO;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 300s;
  }
}
EOF
  ln -sf "$SITIO" /etc/nginx/sites-enabled/agente-social
  if ! nginx -t; then
    echo "La config nueva de nginx no pasó la validación: la quito y no recargo nada."
    rm -f /etc/nginx/sites-enabled/agente-social; exit 1
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
  [ -f "$CF" ] && cp "$CF" "$CF.bak.$(date +%s)"
  if ! grep -qs "^$DOMINIO" "$CF"; then
    # Se agrega el bloque al final; los sitios existentes no se tocan.
    printf '\n%s {\n  request_body {\n    max_size 300MB\n  }\n  reverse_proxy 127.0.0.1:%s\n}\n' "$DOMINIO" "$PUERTO" >> "$CF"
  fi
  caddy validate --config "$CF" --adapter caddyfile && (systemctl reload caddy || systemctl restart caddy)
fi

if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80/tcp; ufw allow 443/tcp; fi

echo
echo "Listo: https://$DOMINIO/admin"
if [ "${NUEVO_ENV:-0}" = 1 ]; then
  echo "Contraseña del panel: $ADMIN_PASS   (guárdala; está en $APP/.env)"
  echo "Falta: poner ANTHROPIC_API_KEY en $APP/.env y correr: sudo systemctl restart agente-social"
fi
echo "Cargar Kuper Media:   sudo -u agente env PATH=$NODE_DIR/bin:/usr/bin:/bin bash -c 'cd $APP && npm run seed'"
echo "Ver el log:           journalctl -u agente-social -f"
