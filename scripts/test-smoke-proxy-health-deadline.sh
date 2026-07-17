#!/usr/bin/env bash
set -euo pipefail

# Regression test: scripts/smoke-proxy-health.sh usaba curl --max-time 15 de
# forma fija en cada intento, sin acotarlo al tiempo que quedaba en la
# ventana global. Con una ventana corta y un upstream que tarda mucho en
# responder (o cuelga), un solo intento podía consumir hasta ese max-time
# fijo y hacer que el script terminara muy por encima de la ventana pedida.
# Este test levanta un servidor local que tarda deliberadamente más que la
# ventana global en responder, y confirma que smoke-proxy-health.sh con una
# ventana corta termina cerca de esa ventana (reloj de pared real), no de
# max-time fijo por intento.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mock_server_path="${script_dir}/mock-proxy-health-server.py"

mock_pid=""
mock_port=""
mock_log=""

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
  mock_port=$(( (RANDOM % 5000) + 25000 ))
  mock_log="$(mktemp -t mock-proxy-health-deadline.XXXXXX.log)"
  python3 "$mock_server_path" "$mock_port" "$mode" >"$mock_log" 2>&1 &
  mock_pid=$!

  # El mock en modo hang:N tarda N segundos en responder a /api/health a
  # propósito, así que no podemos usar una respuesta HTTP como señal de
  # "listo" (esperaríamos justo lo que queremos medir). En su lugar
  # comprobamos que el puerto acepta conexiones TCP, sin esperar cuerpo.
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
if scripts/smoke-proxy-health.sh "http://127.0.0.1:${port}" "$deadline_seconds" 1 >/tmp/proxy-deadline.log 2>&1; then
  cat /tmp/proxy-deadline.log >&2
  echo "smoke-proxy-health.sh debía fallar contra un upstream que nunca responde a tiempo" >&2
  exit 1
fi
elapsed=$(( $(date +%s) - start ))
stop_mock

echo "smoke-proxy-health.sh con ventana de ${deadline_seconds}s (upstream de ~20s) tardó ${elapsed}s en total"

# El upstream tarda ~20s en responder. Si el bug reintrodujera un max-time
# fijo de 15s por intento en vez de acotarlo al tiempo restante, un solo
# intento ya excedería varias veces la ventana de 3s pedida. Toleramos hasta
# el doble de la ventana como margen, pero no más.
if [ "$elapsed" -gt $((deadline_seconds * 2)) ]; then
  echo "::error::smoke-proxy-health.sh tardó ${elapsed}s, muy por encima de la ventana global de ${deadline_seconds}s -- ¿el curl de cada intento dejó de acotarse al tiempo restante?" >&2
  exit 1
fi

echo "Confirmado: smoke-proxy-health.sh acota cada curl al tiempo restante de la ventana global real, sin exceder el deadline de reloj real."
