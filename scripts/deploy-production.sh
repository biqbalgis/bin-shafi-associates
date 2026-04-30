#!/bin/sh
set -eu

COMPOSE_FILE="docker-compose.production.yml"
ROOT_ENV_FILE=".env.production"

if [ ! -f "$ROOT_ENV_FILE" ]; then
  echo "Missing $ROOT_ENV_FILE. Copy .env.production.example first."
  exit 1
fi

if [ ! -f "backend/.env.production" ]; then
  echo "Missing backend/.env.production. Copy backend/.env.production.example first."
  exit 1
fi

set -a
. "./$ROOT_ENV_FILE"
set +a

if [ -z "${DOMAIN:-}" ] || [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
  echo "DOMAIN and LETSENCRYPT_EMAIL must be set in $ROOT_ENV_FILE."
  exit 1
fi

docker compose --env-file "$ROOT_ENV_FILE" -f "$COMPOSE_FILE" up -d db backend frontend nginx

if ! docker compose --env-file "$ROOT_ENV_FILE" -f "$COMPOSE_FILE" run --rm certbot \
  sh -c "[ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]"; then
  docker compose --env-file "$ROOT_ENV_FILE" -f "$COMPOSE_FILE" run --rm certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$LETSENCRYPT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"
  docker compose --env-file "$ROOT_ENV_FILE" -f "$COMPOSE_FILE" restart nginx
fi

docker compose --env-file "$ROOT_ENV_FILE" -f "$COMPOSE_FILE" ps
