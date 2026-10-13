#!/usr/bin/env bash
# Valida las migraciones y las políticas RLS en un PostgreSQL 15+ local desechable.
# Uso (como usuario con acceso a initdb/pg_ctl):  bash muro/backend/supabase/pruebas/ejecutar.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
DIR="$(mktemp -d)"
PUERTO=54329
trap '"$BIN/pg_ctl" -D "$DIR/datos" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

"$BIN/initdb" -D "$DIR/datos" -A trust -U postgres >/dev/null
"$BIN/pg_ctl" -D "$DIR/datos" -o "-p $PUERTO -k $DIR -c listen_addresses=" -l "$DIR/log" start >/dev/null
sleep 1
psql -h "$DIR" -p $PUERTO -U postgres -q -c 'create database muro'
for f in "$AQUI/00_stubs_supabase.sql" "$AQUI/../migrations/0001_esquema.sql" "$AQUI/10_pruebas_rls.sql"; do
  psql -h "$DIR" -p $PUERTO -U postgres -d muro -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
done
