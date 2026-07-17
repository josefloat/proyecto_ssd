#!/usr/bin/env bash
set -uo pipefail

# Uso: smoke-proxy-health.sh <frontend-url> [ventana-global-segundos] [segundos-entre-intentos]
#
# Recorrido completo a través del Route Handler catch-all
# (app/api/[...path]/route.ts). Cada intento upstream lo corta el propio
# Route Handler a los 10s, respondiendo 504 de forma controlada; este
# script reintenta dentro de una ventana global REAL de reloj de pared
# (no un número fijo de intentos) de hasta ~120s, para tolerar el cold
# start acumulado de Render + Neon. Distingue explícitamente 504 (timeout
# del Route Handler) de 503 (fallo real de base de datos reenviado por el
# backend) en cada línea de log, sin confundir ambas causas -- aunque
# ambas se reintentan mientras quede ventana, porque un cold start puede
# producir cualquiera de las dos transitoriamente antes de estabilizarse.

frontend_url="${1:?Uso: smoke-proxy-health.sh <frontend-url> [ventana-segundos] [segundos-entre-intentos]}"
deadline_seconds="${2:-120}"
sleep_seconds="${3:-5}"

start_time="$(date +%s)"
deadline=$((start_time + deadline_seconds))
attempt=0

while [ "$(date +%s)" -lt "$deadline" ]; do
  attempt=$((attempt + 1))

  # Acota --max-time al tiempo que realmente queda en la ventana global: un
  # upstream que tarda o cuelga no debe poder consumir por sí solo más
  # ventana de la que queda, aunque su límite "normal" sea de 15s.
  remaining=$((deadline - $(date +%s)))
  curl_max_time="$remaining"
  if [ "$curl_max_time" -gt 15 ]; then
    curl_max_time=15
  elif [ "$curl_max_time" -lt 1 ]; then
    curl_max_time=1
  fi

  http_code="$(curl -sS --max-time "$curl_max_time" -o /tmp/smoke-proxy-body.json -w '%{http_code}' "${frontend_url}/api/health")"
  body="$(cat /tmp/smoke-proxy-body.json 2>/dev/null || echo '{}')"
  elapsed=$(( $(date +%s) - start_time ))

  case "$http_code" in
    200)
      db="$(echo "$body" | jq -r '.db // empty')"
      if [ "$db" = "ok" ]; then
        echo "intento ${attempt} (t=${elapsed}s/${deadline_seconds}s): 200 db:ok"
        echo "OK: ${frontend_url}/api/health respondió 200 con db:ok tras ${elapsed}s"
        exit 0
      fi
      echo "intento ${attempt} (t=${elapsed}s/${deadline_seconds}s): 200 pero db=${db}"
      echo "::error::${frontend_url}/api/health respondió 200 pero db no es \"ok\" (db=${db})"
      exit 1
      ;;
    504)
      echo "intento ${attempt} (t=${elapsed}s/${deadline_seconds}s): 504 -- timeout del Route Handler (intento upstream >10s), reintentando"
      ;;
    503)
      echo "intento ${attempt} (t=${elapsed}s/${deadline_seconds}s): 503 -- fallo real de base de datos reenviado por el backend, reintentando"
      ;;
    *)
      echo "intento ${attempt} (t=${elapsed}s/${deadline_seconds}s): status inesperado ${http_code}, reintentando"
      ;;
  esac

  remaining=$((deadline - $(date +%s)))
  if [ "$remaining" -gt 0 ]; then
    sleep_time="$sleep_seconds"
    if [ "$sleep_time" -gt "$remaining" ]; then
      sleep_time="$remaining"
    fi
    sleep "$sleep_time"
  fi
done

echo "::error::${frontend_url}/api/health no respondió 200 con db:ok dentro de la ventana global de ${deadline_seconds}s"
exit 1
