#!/usr/bin/env bash
set -euo pipefail

# Regression test: scripts/smoke-health.sh usaba curl --max-time 15 fijo y
# un sleep completo en cada intento, sin acotarlos al tiempo que quedaba en
# la ventana global -- el mismo bug que se corrigió en
# scripts/smoke-proxy-health.sh. Con una ventana corta y un upstream que
# cuelga varios segundos más que esa ventana, un solo intento podía consumir
# hasta el max-time fijo (15s) y hacer que el script terminara muy por
# encima de la ventana pedida. Este test levanta un servidor local que
# tarda ~20s en responder /health, y confirma -- con una tolerancia
# ajustada, no "hasta el doble" -- que smoke-health.sh con una ventana de
# 3s termina cerca de esos 3s (reloj de pared real), no de un curl colgado
# hasta su max-time fijo.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mock_server_path="${script_dir}/mock-health-server.py"

mock_pid=""
mock_port=""
mock_log=""

# mock-health-server.py es un fixture privado de este script (ruta exacta y
# única): cualquier instancia todavía viva que coincida con esa ruta es por
# definición huérfana de esta prueba -- p.ej. dejada por una corrida
# anterior interrumpida -- y es seguro terminarla directamente.
reap_orphans() {
  local pid
  for pid in $(pgrep -f "$mock_server_path" 2>/dev/null || true); do
    kill "$pid" >/dev/null 2>&1 || true
  done
}

stop_mock() {
  if [ -n "$mock_pid" ]; then
    kill "$mock_pid" >/dev/null 2>&1 || true
    wait "$mock_pid" 2>/dev/null || true
    mock_pid=""
  fi
}

cleanup() {
  stop_mock
  reap_orphans
}
trap cleanup EXIT INT TERM

start_mock() {
  local mode="$1"
  mock_port=$(( (RANDOM % 5000) + 20000 ))
  mock_log="$(mktemp -t mock-health-deadline.XXXXXX.log)"
  python3 "$mock_server_path" "$mock_port" "$mode" >"$mock_log" 2>&1 &
  mock_pid=$!

  # El mock en modo hang:N tarda N segundos en responder a /health a
  # propósito, así que no podemos usar una respuesta HTTP de esa ruta como
  # señal de "listo" (esperaríamos justo lo que queremos medir). En su
  # lugar comprobamos que el puerto acepta conexiones TCP, sin esperar
  # cuerpo.
  local ready=""
  local _i
  for _i in $(seq 1 30); do
    if (exec 3<>"/dev/tcp/127.0.0.1/${mock_port}") 2>/dev/null; then
      exec 3>&- 2>/dev/null || true
      exec 3<&- 2>/dev/null || true
      ready="1"
      break
    fi
    sleep 0.2
  done

  if [ -z "$ready" ]; then
    echo "El servidor mock (modo ${mode}) en el puerto ${mock_port} nunca quedó listo; salida:" >&2
    cat "$mock_log" >&2 || true
    exit 1
  fi
}

start_mock hang:20
port="$mock_port"

deadline_seconds=3
start="$(date +%s)"
if scripts/smoke-health.sh "http://127.0.0.1:${port}" "$deadline_seconds" 1 >/tmp/health-deadline.log 2>&1; then
  cat /tmp/health-deadline.log >&2
  echo "smoke-health.sh debía fallar contra un upstream que nunca responde a tiempo" >&2
  exit 1
fi
elapsed=$(( $(date +%s) - start ))
stop_mock

echo "smoke-health.sh con ventana de ${deadline_seconds}s (upstream de ~20s) tardó ${elapsed}s en total"

# El upstream tarda ~20s en responder. Una tolerancia laxa (p.ej. "hasta el
# doble de la ventana") no demuestra nada: un curl colgado hasta su
# max-time fijo de 15s también pasaría esa cota floja sin que el bug quede
# expuesto. Exigimos que termine cerca de la ventana pedida en ambos
# sentidos: ni mucho más tarde (el curl/sleep no se acotó al tiempo
# restante) ni sospechosamente antes (el script no llegó a intentarlo).
if [ "$elapsed" -gt $((deadline_seconds + 2)) ]; then
  echo "::error::smoke-health.sh tardó ${elapsed}s, muy por encima de la ventana global de ${deadline_seconds}s -- ¿el curl/sleep de cada intento dejó de acotarse al tiempo restante?" >&2
  exit 1
fi
if [ "$elapsed" -lt $((deadline_seconds - 1)) ]; then
  echo "::error::smoke-health.sh terminó en ${elapsed}s, sospechosamente antes de la ventana de ${deadline_seconds}s -- ¿de verdad se ejercitó un curl colgado?" >&2
  exit 1
fi

echo "Confirmado: smoke-health.sh acota cada curl y cada sleep al tiempo restante de la ventana global real, sin exceder el deadline de reloj real."
