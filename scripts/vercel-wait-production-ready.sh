#!/usr/bin/env bash
set -euo pipefail

# Uso: vercel-wait-production-ready.sh <sha-esperado> <dominio-canonico> [intentos] [segundos]
#
# Requiere VERCEL_TOKEN, VERCEL_PROJECT_ID y VERCEL_ORG_ID en el entorno.
# Hace polling de GET /v9/projects/{id} hasta que targets.production esté
# READY, y delega la validación (target=production, READY, dominio canónico,
# SHA) a
# vercel-parse-production-target.sh -en vez de volver a consultar la URL
# de Preview, que es el defecto que corrige esta sección-. Imprime
# "domain=<dominio>" en stdout si todo es válido.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
expected_sha="${1:?Uso: vercel-wait-production-ready.sh <sha-esperado> <dominio-canonico> [intentos] [segundos]}"
expected_domain="${2:?Uso: vercel-wait-production-ready.sh <sha-esperado> <dominio-canonico> [intentos] [segundos]}"
max_attempts="${3:-18}"
sleep_seconds="${4:-10}"

: "${VERCEL_TOKEN:?falta VERCEL_TOKEN}"
: "${VERCEL_PROJECT_ID:?falta VERCEL_PROJECT_ID}"
: "${VERCEL_ORG_ID:?falta VERCEL_ORG_ID}"

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

for attempt in $(seq 1 "$max_attempts"); do
  http_code="$(curl -sS -o "$tmp_file" -w '%{http_code}' \
    "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}?teamId=${VERCEL_ORG_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}")"
  if [ "$http_code" -ge 300 ]; then
    echo "::error::La API de Vercel devolvió ${http_code} al consultar el proyecto" >&2
    cat "$tmp_file" >&2
    exit 1
  fi

  ready_state="$(jq -r '.targets.production.readyState // empty' "$tmp_file")"
  echo "intento ${attempt}/${max_attempts}: readyState=${ready_state:-"(sin targets.production)"}" >&2

  if [ "$ready_state" = "READY" ]; then
    "$script_dir/vercel-parse-production-target.sh" \
      "$tmp_file" "$expected_sha" "$expected_domain"
    exit 0
  fi

  case "$ready_state" in
    ERROR|CANCELED)
      echo "::error::El deployment de producción terminó en readyState=${ready_state}" >&2
      cat "$tmp_file" >&2
      exit 1
      ;;
  esac

  if [ "$attempt" -lt "$max_attempts" ]; then
    sleep "$sleep_seconds"
  fi
done

echo "::error::El deployment de producción no llegó a READY tras ${max_attempts} intentos" >&2
exit 1
