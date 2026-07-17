#!/usr/bin/env bash
set -euo pipefail

# Uso: vercel-parse-production-target.sh <archivo-json-de-GET-projects> <sha-esperado> <dominio-canonico>
#
# Valida targets.production de la respuesta de GET /v9/projects/{id} de la
# API de Vercel (guardada en un archivo) y confirma que es un deployment de
# producción real, listo, con el commit esperado y con el dominio canónico
# configurado entre sus aliases -- en vez de volver a
# confiar en la URL de Preview usada antes de `vercel promote`. Falla
# explícitamente si el payload no es de producción, si no está READY, si el
# dominio canónico no aparece
# asociado, o si el commit no coincide (delegado a assert-commit-match.sh,
# que también cubre el caso de un commit vacío). Si todo es válido, imprime
# "domain=<dominio>" en stdout para que el llamador haga el smoke HTTP.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_json_file="${1:?Uso: vercel-parse-production-target.sh <archivo-json> <sha-esperado> <dominio-canonico>}"
expected_sha="${2:?Uso: vercel-parse-production-target.sh <archivo-json> <sha-esperado> <dominio-canonico>}"
expected_domain="${3:?Uso: vercel-parse-production-target.sh <archivo-json> <sha-esperado> <dominio-canonico>}"

production="$(jq -c '.targets.production // empty' "$project_json_file")"
if [ -z "$production" ]; then
  echo "::error::La respuesta de la API de Vercel no tiene targets.production" >&2
  exit 1
fi

target="$(echo "$production" | jq -r '.target // empty')"
if [ "$target" != "production" ]; then
  echo "::error::targets.production no es un deployment de producción (target=${target:-vacío}); ¿payload de Preview?" >&2
  exit 1
fi

ready_state="$(echo "$production" | jq -r '.readyState // empty')"
if [ "$ready_state" != "READY" ]; then
  echo "::error::targets.production no está READY (readyState=${ready_state:-vacío})" >&2
  exit 1
fi

if ! echo "$production" | jq -e --arg domain "$expected_domain" \
  '(.alias | type == "array") and (.alias | index($domain) != null)' >/dev/null; then
  echo "::error::targets.production.alias no contiene el dominio canónico configurado (${expected_domain})" >&2
  exit 1
fi

commit_sha="$(echo "$production" | jq -r '.meta.commitSha // empty')"
"$script_dir/assert-commit-match.sh" "$commit_sha" "$expected_sha" >&2

echo "domain=${expected_domain}"
