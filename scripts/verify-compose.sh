#!/usr/bin/env bash
set -euo pipefail

readonly GOOD_PROJECT="senal-de-vida-compose-ok-$$"
readonly BAD_PROJECT="senal-de-vida-compose-bad-env-$$"

# Puertos efímeros: la prueba no interfiere con un Compose del desarrollador.
export DB_PORT=0
export API_PORT=0
export WEB_PORT=0

cleanup() {
  docker compose -p "$GOOD_PROJECT" down --volumes --remove-orphans >/dev/null 2>&1 || true
  docker compose -p "$BAD_PROJECT" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_http() {
  local project="$1"
  local service="$2"
  local url="$3"

  for _ in $(seq 1 60); do
    if docker compose -p "$project" exec -T "$service" node -e "fetch('$url').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"; then
      return 0
    fi
    sleep 1
  done

  echo "El servicio $service no respondió correctamente en $url" >&2
  return 1
}

docker compose -p "$GOOD_PROJECT" up --build --detach
wait_for_http "$GOOD_PROJECT" api "http://api:4000/live"
wait_for_http "$GOOD_PROJECT" api "http://api:4000/health"
wait_for_http "$GOOD_PROJECT" api "http://web:3000/"

docker compose -p "$BAD_PROJECT" -f docker-compose.yml -f scripts/compose-api-missing-db-url.yml up --build --detach db api

for _ in $(seq 1 60); do
  api_id="$(docker compose -p "$BAD_PROJECT" -f docker-compose.yml -f scripts/compose-api-missing-db-url.yml ps --quiet api)"
  if [ -n "$api_id" ] && [ "$(docker inspect --format '{{.State.Status}}' "$api_id")" = "exited" ]; then
    break
  fi
  sleep 1
done

if [ -z "${api_id:-}" ] || [ "$(docker inspect --format '{{.State.ExitCode}}' "$api_id")" -eq 0 ]; then
  echo "La API debía fallar al faltar DATABASE_URL" >&2
  exit 1
fi

docker compose -p "$BAD_PROJECT" -f docker-compose.yml -f scripts/compose-api-missing-db-url.yml logs api | grep --quiet "Faltan variables de entorno requeridas: DATABASE_URL"

echo "Verificación Compose completada: camino feliz y configuración inválida comprobados."
