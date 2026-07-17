#!/usr/bin/env bash
set -u

fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT

migrate_ok() {
  return 0
}

seed_ok() {
  return 0
}

seed_fail() {
  return 23
}

deploy_render_spy() {
  touch "$fixture_dir/render"
}

deploy_vercel_spy() {
  touch "$fixture_dir/vercel"
}

run_gate() {
  "$1" || return $?
  "$2" || return $?
  "$3" || return $?
  "$4" || return $?
}

run_gate migrate_ok seed_ok deploy_render_spy deploy_vercel_spy
test -f "$fixture_dir/render"
test -f "$fixture_dir/vercel"

rm "$fixture_dir/render" "$fixture_dir/vercel"
if run_gate migrate_ok seed_fail deploy_render_spy deploy_vercel_spy; then
  echo "El fixture esperaba que un seed fallido detuviera el gate" >&2
  exit 1
fi
test ! -e "$fixture_dir/render"
test ! -e "$fixture_dir/vercel"
