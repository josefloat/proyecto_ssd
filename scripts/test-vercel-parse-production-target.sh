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
expected_domain="senal-de-vida-frontend.vercel.app"
protected_domain="senal-de-vida-frontend-josefloats-projects.vercel.app"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

write_fixture() {
  cat >"$tmp_dir/$1"
}

echo "Caso 1: alias protegido primero y canónico segundo -> debe devolver el canónico"
write_fixture protected-first.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": ["${protected_domain}", "${expected_domain}"], "meta": {"commitSha": "${expected_sha}"}}}}
EOF
output="$("$script" "$tmp_dir/protected-first.json" "$expected_sha" "$expected_domain")"
if [ "$output" != "domain=${expected_domain}" ]; then
  echo "Se esperaba domain=${expected_domain}, se obtuvo: $output" >&2
  exit 1
fi

echo "Caso 2: dominio canónico primero y alias protegido segundo -> mismo resultado"
write_fixture public-first.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": ["${expected_domain}", "${protected_domain}"], "meta": {"commitSha": "${expected_sha}"}}}}
EOF
output="$("$script" "$tmp_dir/public-first.json" "$expected_sha" "$expected_domain")"
if [ "$output" != "domain=${expected_domain}" ]; then
  echo "Se esperaba domain=${expected_domain}, se obtuvo: $output" >&2
  exit 1
fi

echo "Caso 3: dominio canónico configurado ausente -> debe fallar"
write_fixture missing-domain.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": ["${protected_domain}", "otro-dominio.vercel.app"], "meta": {"commitSha": "${expected_sha}"}}}}
EOF
if "$script" "$tmp_dir/missing-domain.json" "$expected_sha" "$expected_domain" 2>"$tmp_dir/missing-domain.txt"; then
  echo "El script debía fallar si falta el dominio canónico configurado" >&2
  exit 1
fi
grep --quiet "no contiene el dominio canónico configurado" "$tmp_dir/missing-domain.txt"

echo "Caso 4: payload de Preview (target=preview) -> debe fallar sin confirmar nada"
write_fixture preview.json <<EOF
{"targets": {"production": {"target": "preview", "readyState": "READY", "alias": ["${expected_domain}"], "meta": {"commitSha": "${expected_sha}"}}}}
EOF
if "$script" "$tmp_dir/preview.json" "$expected_sha" "$expected_domain" 2>"$tmp_dir/preview.txt"; then
  echo "El script debía fallar ante un payload de Preview" >&2
  exit 1
fi
grep --quiet "no es un deployment de producción" "$tmp_dir/preview.txt"

echo "Caso 5: SHA vacío -> debe fallar, no pasar en silencio"
write_fixture empty-sha.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": ["${expected_domain}"], "meta": {}}}}
EOF
if "$script" "$tmp_dir/empty-sha.json" "$expected_sha" "$expected_domain" 2>"$tmp_dir/empty-sha.txt"; then
  echo "El script debía fallar ante un meta.commitSha vacío" >&2
  exit 1
fi
grep --quiet "no devolvió un commit desplegado" "$tmp_dir/empty-sha.txt"

echo "Caso 6: SHA distinto a github.sha -> debe fallar"
write_fixture wrong-sha.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": ["${expected_domain}"], "meta": {"commitSha": "otro-commit-completamente-distinto"}}}}
EOF
if "$script" "$tmp_dir/wrong-sha.json" "$expected_sha" "$expected_domain" 2>"$tmp_dir/wrong-sha.txt"; then
  echo "El script debía fallar ante un commitSha distinto" >&2
  exit 1
fi
grep --quiet "no coincide con el esperado" "$tmp_dir/wrong-sha.txt"

echo "Caso 7: alias vacío -> debe fallar porque falta el dominio configurado"
write_fixture no-alias.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "READY", "alias": [], "meta": {"commitSha": "${expected_sha}"}}}}
EOF
if "$script" "$tmp_dir/no-alias.json" "$expected_sha" "$expected_domain" 2>"$tmp_dir/no-alias.txt"; then
  echo "El script debía fallar ante un alias vacío" >&2
  exit 1
fi
grep --quiet "no contiene el dominio canónico configurado" "$tmp_dir/no-alias.txt"

echo "Caso 8: producción aún no READY -> debe fallar"
write_fixture not-ready.json <<EOF
{"targets": {"production": {"target": "production", "readyState": "BUILDING", "alias": ["${expected_domain}"], "meta": {"commitSha": "${expected_sha}"}}}}
EOF
if "$script" "$tmp_dir/not-ready.json" "$expected_sha" "$expected_domain" 2>"$tmp_dir/not-ready.txt"; then
  echo "El script debía fallar si targets.production aún no está READY" >&2
  exit 1
fi
grep --quiet "no está READY" "$tmp_dir/not-ready.txt"

echo "Todos los casos de vercel-parse-production-target.sh se comportaron como se esperaba."
