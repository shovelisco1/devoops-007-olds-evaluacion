
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  CONFIGURED_PORT=$(sed -n 's/^HOST_PORT=//p' .env | tail -n 1)
else
  CONFIGURED_PORT=""
fi

HOST_PORT="${HOST_PORT:-${CONFIGURED_PORT:-3000}}"
SERVICE_URL="http://127.0.0.1:${HOST_PORT}"

if ! [[ "$HOST_PORT" =~ ^[0-9]+$ ]]; then
  echo "Error: HOST_PORT debe ser un numero."
  exit 1
fi

if [[ ! -f coverage/coverage-summary.json ]]; then
  echo "Primero ejecuta: npm run test:ci"
  exit 1
fi

START_SECONDS=$(date +%s)

docker compose --profile monitoring up --build -d

for intento in $(seq 1 30); do
  if curl --fail --silent "${SERVICE_URL}/api/health" >/dev/null; then
    break
  fi

  if [[ "$intento" -eq 30 ]]; then
    docker compose --profile monitoring logs microservicio
    exit 1
  fi

  sleep 2
done

for intento in $(seq 1 20); do
  if curl --fail --silent http://127.0.0.1:9091/-/ready >/dev/null; then
    break
  fi

  if [[ "$intento" -eq 20 ]]; then
    docker compose --profile monitoring logs pushgateway
    exit 1
  fi

  sleep 1
done

END_SECONDS=$(date +%s)
DEPLOYMENT_DURATION=$((END_SECONDS - START_SECONDS))

CI_DEPLOYMENT_DURATION_SECONDS="$DEPLOYMENT_DURATION" node scripts/push-ci-metrics.js

echo "Microservicio: ${SERVICE_URL}"
echo "Grafana: http://localhost:3001"
echo "Prometheus: http://localhost:9090"
echo "Pushgateway: http://localhost:9091"
echo "Duracion del despliegue local: ${DEPLOYMENT_DURATION}s"
