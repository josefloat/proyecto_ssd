#!/usr/bin/env bash
set -euo pipefail

# Uso: assert-commit-match.sh <commit-desplegado> <commit-esperado>
#
# Falla explícitamente si el commit reportado por la API del proveedor no
# coincide con github.sha (o viene vacío), en vez de dejar pasar un
# despliegue de un commit distinto como falso verde. La usan tanto el job
# deploy-render como deploy-vercel de .github/workflows/ci.yml.

actual="${1:-}"
expected="${2:-}"

if [ -z "$expected" ]; then
  echo "::error::Falta el commit esperado (github.sha)" >&2
  exit 2
fi

if [ -z "$actual" ]; then
  echo "::error::La API no devolvió un commit desplegado; no se puede confirmar que sea ${expected}" >&2
  exit 1
fi

if [ "$actual" != "$expected" ]; then
  echo "::error::Commit desplegado (${actual}) no coincide con el esperado (${expected})" >&2
  exit 1
fi

echo "Commit desplegado coincide con el esperado (${expected})."
