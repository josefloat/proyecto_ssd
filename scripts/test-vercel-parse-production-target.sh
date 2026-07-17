#!/usr/bin/env bash
set -euo pipefail

# Fixtures puras para los escenarios "Deployment de producción real
# confirmado tras la promoción", "Payload de Preview rechazado en la
# verificación de producción" y "SHA de producción vacío o distinto
# detectado y bloqueado" de specs/deployment-pipeline/spec.md. Ejercita
# scripts/vercel-parse-production-target.sh -el mismo script que usa
# deploy-vercel- con respuestas de ejemplo de GET /v9/projects/{id}, sin
# llamar a la API real de Vercel ni tocar producción.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$script_dir/vercel-parse-production-target.sh"
expected_sha="abc123def456"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

write_fixture() {
  cat >"$tmp_dir/$1"
}

echo "Caso 1: producción real, lista, con el commit esperado -> debe pasar y devolver el dominio"
write_fixture ok.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": ["senal-de-vida.vercel.app", "senal-de-vida-git-main.vercel.app"], "meta": {"commitSha": "${expected_sha}"}}}}
EOF
output="$("$script" "$tmp_dir/ok.json" "$expected_sha")"
if [ "$output" != "domain=senal-de-vida.vercel.app" ]; then
  echo "Se esperaba domain=senal-de-vida.vercel.app, se obtuvo: $output" >&2
  exit 1
fi

echo "Caso 2: payload de Preview (target=preview) -> debe fallar sin confirmar nada"
write_fixture preview.json <<EOF
{"targets": {"production": {"target": "preview", "readyState": "READY", "alias": ["senal-de-vida-abc123.vercel.app"], "meta": {"commitSha": "${expected_sha}"}}}}
EOF
if "$script" "$tmp_dir/preview.json" "$expected_sha" 2>/tmp/vercel-parse-preview.txt; then
  echo "El script debía fallar ante un payload de Preview" >&2
  exit 1
fi
grep --quiet "no es un deployment de producción" /tmp/vercel-parse-preview.txt

echo "Caso 3: SHA vacío -> debe fallar, no pasar en silencio"
write_fixture empty-sha.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": ["senal-de-vida.vercel.app"], "meta": {}}}}
EOF
if "$script" "$tmp_dir/empty-sha.json" "$expected_sha" 2>/tmp/vercel-parse-empty.txt; then
  echo "El script debía fallar ante un meta.commitSha vacío" >&2
  exit 1
fi
grep --quiet "no devolvió un commit desplegado" /tmp/vercel-parse-empty.txt

echo "Caso 4: SHA distinto a github.sha -> debe fallar"
write_fixture wrong-sha.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": ["senal-de-vida.vercel.app"], "meta": {"commitSha": "otro-commit-completamente-distinto"}}}}
EOF
if "$script" "$tmp_dir/wrong-sha.json" "$expected_sha" 2>/tmp/vercel-parse-wrong.txt; then
  echo "El script debía fallar ante un commitSha distinto" >&2
  exit 1
fi
grep --quiet "no coincide con el esperado" /tmp/vercel-parse-wrong.txt

echo "Caso 5: sin dominio asociado (alias vacío) -> debe fallar"
write_fixture no-alias.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": [], "meta": {"commitSha": "${expected_sha}"}}}}
EOF
if "$script" "$tmp_dir/no-alias.json" "$expected_sha" 2>/tmp/vercel-parse-no-alias.txt; then
  echo "El script debía fallar ante un alias vacío" >&2
  exit 1
fi
grep --quiet "no tiene ningún dominio asociado" /tmp/vercel-parse-no-alias.txt

echo "Todos los casos de vercel-parse-production-target.sh se comportaron como se esperaba."
