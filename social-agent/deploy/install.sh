#!/usr/bin/env bash
# Instala el agente social en un servidor Ubuntu (22.04 / 24.04), p. ej. un droplet de DigitalOcean.
#
#   curl -fsSL https://raw.githubusercontent.com/jmanole2/novaplastica/agente-publicador-redes-sociales/social-agent/deploy/install.sh \
#     | sudo DOMINIO=agente.kuper.media bash
#
# Qué hace: instala Node 22 y Chromium con sus dependencias, clona el repo en /opt/agente-social,
# crea el usuario "agente", genera el .env (con SECRET_KEY y contraseña de admin al azar),
# lo deja como servicio de systemd que arranca solo, y pone https con Caddy (o con nginx
# + certbot si el servidor ya usa nginx). Se puede volver a correr sin romper nada.
set -euo pipefail

DOMINIO="${DOMINIO:-}"
REPO="${REPO:-https://github.com/jmanole2/novaplastica.git}"
RAMA="${RAMA:-agente-publicador-redes-sociales}"
DIR=/opt/agente-social
APP="$DIR/social-agent"
PUERTO="${PUERTO:-3000}"
EMAIL="${EMAIL:-}"

[ "$(id -u)" = 0 ] || { echo "Córrelo con sudo."; exit 1; }
[ -n "$DOMINIO" ] || { echo "Falta DOMINIO (p. ej. DOMINIO=agente.kuper.media). Debe apuntar ya a la IP de este servidor."; exit 1; }

# Servidores con menos de 2 GB: un render de Reel usa ~750 MB en el pico (Chromium + ffmpeg),
# así que se agrega swap como colchón para que nunca se caiga por memoria.
RAM_MB=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
if [ "$RAM_MB" -lt 1900 ] && ! swapon --show | grep -q .; then
  echo "==> ${RAM_MB} MB de RAM: creando 2 GB de swap"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null && echo 'vm.swappiness=10' > /etc/sysctl.d/99-agente-swap.conf
fi

echo "==> Paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "==> Node 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Usuario y código"
id agente >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin agente
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --depth 1 origin "$RAMA" && git -C "$DIR" checkout -B "$RAMA" "origin/$RAMA"
else
  git clone --depth 1 --branch "$RAMA" "$REPO" "$DIR"
fi
chown -R agente:agente "$DIR"

echo "==> Dependencias (npm + Chromium)"
sudo -u agente bash -c "cd '$APP' && npm ci --omit=dev"
(cd "$APP" && npx --yes playwright@1.56.1 install-deps chromium)
sudo -u agente bash -c "cd '$APP' && npx playwright install chromium"

echo "==> .env"
if [ ! -f "$APP/.env" ]; then
  ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  cp "$APP/.env.example" "$APP/.env"
  sed -i "s|^PORT=.*|PORT=$PUERTO|; s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://$DOMINIO|; s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PASS|; s|^SECRET_KEY=.*|SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')|" "$APP/.env"
  chown agente:agente "$APP/.env"; chmod 600 "$APP/.env"
  NUEVO_ENV=1
fi

echo "==> Servicio"
cat > /etc/systemd/system/agente-social.service <<EOF
[Unit]
Description=Agente publicador de redes sociales
After=network-online.target
Wants=network-online.target

[Service]
User=agente
WorkingDirectory=$APP
ExecStart=/usr/bin/node --no-warnings=ExperimentalWarning --env-file=$APP/.env src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now agente-social
systemctl restart agente-social

echo "==> https para $DOMINIO"
if systemctl is-active --quiet nginx; then
  # El servidor ya usa nginx: se agrega un sitio y el certificado con certbot.
  cat > /etc/nginx/sites-available/agente-social <<EOF
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
  ln -sf /etc/nginx/sites-available/agente-social /etc/nginx/sites-enabled/agente-social
  nginx -t && systemctl reload nginx
  apt-get install -y certbot python3-certbot-nginx
  if [ -n "$EMAIL" ]; then CORREO=(-m "$EMAIL"); else CORREO=(--register-unsafely-without-email); fi
  certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos "${CORREO[@]}" --redirect
else
  if ! command -v caddy >/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y && apt-get install -y caddy
  fi
  cat > /etc/caddy/Caddyfile <<EOF
$DOMINIO {
  request_body {
    max_size 300MB
  }
  reverse_proxy 127.0.0.1:$PUERTO
}
EOF
  systemctl reload caddy || systemctl restart caddy
fi

if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80/tcp; ufw allow 443/tcp; fi

echo
echo "Listo: https://$DOMINIO/admin"
if [ "${NUEVO_ENV:-0}" = 1 ]; then
  echo "Contraseña del panel: $ADMIN_PASS   (guárdala; está en $APP/.env)"
  echo "Falta: poner ANTHROPIC_API_KEY en $APP/.env y correr: sudo systemctl restart agente-social"
fi
echo "Cargar Kuper Media:   sudo -u agente bash -c 'cd $APP && npm run seed'"
echo "Ver el log:           journalctl -u agente-social -f"
