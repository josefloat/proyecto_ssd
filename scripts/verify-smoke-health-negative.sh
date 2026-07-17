#!/usr/bin/env bash
set -euo pipefail

# Escenario "URL pooled inválida detectada en un entorno efímero de prueba"
# de specs/deployment-pipeline/spec.md. Levanta un stack Compose efímero
# (nunca toca Render/Neon reales) con una DATABASE_URL pooled sintácticamente
# válida pero inalcanzable. El proceso arranca bien (la validación de
# arranque solo exige que la variable esté presente, no que sea válida),
# así que /health debe responder 503 al intentar `SELECT 1`. Confirma que
# scripts/smoke-health.sh -el mismo script que corre contra producción-
# detecta ese 503 y falla, en vez de pasar en silencio.

readonly PROJECT="senal-de-vida-smoke-health-negative-$$"

export DB_PORT=0
export API_PORT=0
export WEB_PORT=0

cleanup() {
  docker compose -p "$PROJECT" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose -p "$PROJECT" -f docker-compose.yml -f scripts/compose-api-invalid-pooled-url.yml up --build --detach db api

api_port="$(docker compose -p "$PROJECT" port api 4000 | cut -d: -f2)"
base_url="http://localhost:${api_port}"

echo "Esperando a que el proceso (no la base de datos) esté arriba en ${base_url}/live ..."
up=""
for _ in $(seq 1 30); do
  if [ "$(curl -sS -o /dev/null -w '%{http_code}' "${base_url}/live" 2>/dev/null || echo 000)" = "200" ]; then
    up="1"
    break
  fi
  sleep 1
done

if [ -z "$up" ]; then
  echo "El proceso de la API nunca respondió /live; no se pudo montar el fixture" >&2
  exit 1
fi

echo "Confirmando que scripts/smoke-health.sh detecta la DATABASE_URL pooled inválida ..."
if scripts/smoke-health.sh "$base_url" 5 1; then
  echo "scripts/smoke-health.sh debía fallar contra una DATABASE_URL pooled inválida" >&2
  exit 1
fi

echo "Confirmado: smoke-health.sh detecta el 503 de una DATABASE_URL pooled inválida sin tocar producción."
