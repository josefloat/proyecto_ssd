#!/usr/bin/env bash
set -euo pipefail

# Fixture puro para el escenario "Desajuste de commit detectado y bloqueado"
# de specs/deployment-pipeline/spec.md. Prueba scripts/assert-commit-match.sh
# -el mismo script que usan deploy-render y deploy-vercel para confirmar el
# commit live- con commits de ejemplo, sin llamar a las APIs reales de
# Render/Vercel ni tocar producción.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$script_dir/assert-commit-match.sh"

echo "Caso 1: commit coincide (camino feliz) -> debe pasar"
"$script" "abc123def456" "abc123def456"

echo "Caso 2: commit desajustado (ej. auto-deploy concurrente aplicó otro commit) -> debe fallar"
if "$script" "aaa111" "abc123def456" 2>/tmp/assert-commit-match-mismatch.txt; then
  echo "El script debía fallar ante un commit desajustado" >&2
  exit 1
fi
grep --quiet "no coincide con el esperado" /tmp/assert-commit-match-mismatch.txt

echo "Caso 3: la API no devolvió commit (respuesta vacía) -> debe fallar, no pasar en silencio"
if "$script" "" "abc123def456" 2>/tmp/assert-commit-match-empty.txt; then
  echo "El script debía fallar cuando la API no devuelve un commit" >&2
  exit 1
fi
grep --quiet "no devolvió un commit desplegado" /tmp/assert-commit-match-empty.txt

echo "Todos los casos de assert-commit-match.sh se comportaron como se esperaba."
