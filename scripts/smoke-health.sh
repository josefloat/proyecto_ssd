#!/usr/bin/env bash
set -uo pipefail

# Uso: smoke-health.sh <base-url> [ventana-global-segundos] [segundos-entre-intentos]
#
# Reintenta <base-url>/health tolerando el cold start de Render/Neon dentro
# de una ventana global REAL de tiempo transcurrido (reloj de pared), no
# solo un número de intentos: con curl --max-time 15 y sleep 5, contar 18
# intentos podía tardar hasta ~355s en vez de los ~90s pretendidos. Falla
# explícitamente (503 u otro código distinto de 200) sin confundirlo con
# éxito. Se usa tanto contra la URL real de producción (ventana generosa,
# ~90s) como contra un entorno efímero de prueba con DATABASE_URL pooled
# inválida (ventana corta, para demostrar que este mismo mecanismo detecta
# el 503 sin tocar producción).

base_url="${1:?Uso: smoke-health.sh <base-url> [ventana-segundos] [segundos-entre-intentos]}"
deadline_seconds="${2:-90}"
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

  http_code="$(curl -sS --max-time "$curl_max_time" -o /tmp/smoke-health-body.json -w '%{http_code}' "${base_url}/health")"
  body="$(cat /tmp/smoke-health-body.json 2>/dev/null || echo '{}')"
  elapsed=$(( $(date +%s) - start_time ))
  echo "intento ${attempt} (t=${elapsed}s/${deadline_seconds}s): status=${http_code} body=${body}"

  if [ "$http_code" = "200" ]; then
    db="$(echo "$body" | jq -r '.db // empty')"
    if [ "$db" = "ok" ]; then
      echo "OK: ${base_url}/health respondió 200 con db:ok tras ${elapsed}s"
      exit 0
    fi
    echo "::error::${base_url}/health respondió 200 pero db no es \"ok\" (db=${db})"
    exit 1
  fi

  if [ "$http_code" != "503" ]; then
    echo "::warning::status inesperado ${http_code} (se esperaba 200 o 503 durante el cold start)"
  fi

  remaining=$((deadline - $(date +%s)))
  if [ "$remaining" -gt 0 ]; then
    sleep_time="$sleep_seconds"
    if [ "$sleep_time" -gt "$remaining" ]; then
      sleep_time="$remaining"
    fi
    sleep "$sleep_time"
  fi
done

echo "::error::${base_url}/health no respondió 200 con db:ok dentro de la ventana global de ${deadline_seconds}s"
exit 1
