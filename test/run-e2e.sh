#!/usr/bin/env sh
# Runs the E2E suite inside a node:24-alpine container that shares the network
# namespace of the PostgreSQL container (the host cannot reach Docker over TCP
# in the sandbox). The global setup clones apreu_demo / apreu_master into
# apreu_e2e_demo / apreu_e2e_master and drops them at the end.
#
#   test/run-e2e.sh                     # whole suite
#   test/run-e2e.sh test/finance.e2e-spec.ts -t "recibo"   # extra vitest args
#
# Env: E2E_PG_CONTAINER (default apreu-dev-pg), E2E_KEEP_DB=1 keeps the clones,
# E2E_SOURCE_TENANT_DB / E2E_SOURCE_MASTER_DB clone other databases instead of
# apreu_demo / apreu_master (e.g. copies nobody is connected to while the dev API runs).
set -eu
API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$API_DIR/.." && pwd)"
PG_CONTAINER="${E2E_PG_CONTAINER:-apreu-dev-pg}"

exec docker run --rm \
  --network "container:${PG_CONTAINER}" \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e E2E_KEEP_DB="${E2E_KEEP_DB:-}" -e NO_COLOR="${NO_COLOR:-}" \
  -e E2E_SOURCE_TENANT_DB="${E2E_SOURCE_TENANT_DB:-apreu_demo}" -e E2E_SOURCE_MASTER_DB="${E2E_SOURCE_MASTER_DB:-apreu_master}" \
  -e TENANT_DB_HOST=127.0.0.1 -e TENANT_DB_PORT=5432 \
  -e TENANT_DB_USER="${TENANT_DB_USER:-postgres}" -e TENANT_DB_PASSWORD="${TENANT_DB_PASSWORD:-postgres}" \
  -v "${ROOT_DIR}:/work" -w /work/apreu-api \
  node:24-alpine npx vitest run --config vitest.config.e2e.ts "$@"
