#!/usr/bin/env bash
set -euo pipefail

# Fixtures puras para los escenarios "Recorrido completo a través del
# proxy responde dentro de la ventana global" y "Timeout de proxy
# distinguido de un fallo real de base de datos" de
# specs/deployment-pipeline/spec.md. Ejercita scripts/smoke-proxy-health.sh
# -el mismo script que corre contra la URL real de producción- contra un
# servidor local que simula las cuatro ramas (200, 503, 504, agotamiento
# de la ventana), sin tocar Render/Vercel/Neon reales.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mock_server_path="${script_dir}/mock-proxy-health-server.py"

mock_pid=""
mock_port=""
mock_log=""

# mock-proxy-health-server.py es un fixture privado de este script (ruta
# exacta y única): cualquier instancia todavía viva que coincida con esa
# ruta es por definición huérfana de esta prueba -- p.ej. dejada por una
# corrida anterior interrumpida -- y es seguro terminarla directamente.
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

# IMPORTANTE: nunca invocar start_mock mediante $(...). start_mock deja el
# servidor mock corriendo en segundo plano (&); si se llama dentro de una
# sustitución de comando, ese hijo backgroundeado hereda el extremo de
# escritura del pipe de captura y lo mantiene abierto aun después de que la
# función "retorna" -- la sustitución nunca ve EOF y el script se cuelga
# indefinidamente. Por eso start_mock no imprime el puerto por stdout: deja
# mock_port y mock_pid como variables del shell actual para que el llamador
# las lea directamente.
start_mock() {
  local mode="$1"
  mock_port=$(( (RANDOM % 5000) + 25000 ))
  mock_log="$(mktemp -t mock-proxy-health.XXXXXX.log)"
  python3 "$mock_server_path" "$mock_port" "$mode" >"$mock_log" 2>&1 &
  mock_pid=$!

  local ready=""
  local _i
  for _i in $(seq 1 30); do
    if curl -sS -o /dev/null --max-time 1 "http://127.0.0.1:${mock_port}/api/health" 2>/dev/null; then
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

echo "Caso 1: 200 con db:ok de inmediato -> debe pasar sin agotar la ventana"
start_mock always200
port="$mock_port"
if ! scripts/smoke-proxy-health.sh "http://127.0.0.1:${port}" 10 1 >/tmp/proxy-case1.log 2>&1; then
  cat /tmp/proxy-case1.log >&2
  echo "El caso 200 debía pasar" >&2
  exit 1
fi
grep --quiet "200 db:ok" /tmp/proxy-case1.log
stop_mock

echo "Caso 2: 503 persistente (fallo real de BD) -> debe agotar la ventana y fallar, distinguido de un timeout"
start_mock always503
port="$mock_port"
start="$(date +%s)"
if scripts/smoke-proxy-health.sh "http://127.0.0.1:${port}" 5 1 >/tmp/proxy-case2.log 2>&1; then
  cat /tmp/proxy-case2.log >&2
  echo "El caso 503 persistente debía fallar" >&2
  exit 1
fi
elapsed=$(( $(date +%s) - start ))
stop_mock
grep --quiet "fallo real de base de datos" /tmp/proxy-case2.log
if [ "$elapsed" -gt 10 ]; then
  echo "El caso 503 tardó ${elapsed}s, muy por encima de la ventana de 5s" >&2
  exit 1
fi

echo "Caso 3: 504 persistente (timeout del Route Handler) -> debe agotar la ventana y fallar, distinguido de un fallo de BD"
start_mock always504
port="$mock_port"
start="$(date +%s)"
if scripts/smoke-proxy-health.sh "http://127.0.0.1:${port}" 5 1 >/tmp/proxy-case3.log 2>&1; then
  cat /tmp/proxy-case3.log >&2
  echo "El caso 504 persistente debía fallar" >&2
  exit 1
fi
elapsed=$(( $(date +%s) - start ))
stop_mock
grep --quiet "timeout del Route Handler" /tmp/proxy-case3.log
if [ "$elapsed" -gt 10 ]; then
  echo "El caso 504 tardó ${elapsed}s, muy por encima de la ventana de 5s" >&2
  exit 1
fi

echo "Caso 4: 504 en los primeros intentos, luego 200 db:ok -> debe recuperarse dentro de la ventana"
start_mock recover:2
port="$mock_port"
if ! scripts/smoke-proxy-health.sh "http://127.0.0.1:${port}" 10 1 >/tmp/proxy-case4.log 2>&1; then
  cat /tmp/proxy-case4.log >&2
  echo "El caso de recuperación tras 504 debía terminar en éxito" >&2
  exit 1
fi
grep --quiet "504 -- timeout del Route Handler" /tmp/proxy-case4.log
grep --quiet "200 db:ok" /tmp/proxy-case4.log
stop_mock

echo "Todos los casos de smoke-proxy-health.sh se comportaron como se esperaba."
