#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRAFANA_ADMIN_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-}"

if [[ -z "$GRAFANA_ADMIN_PASSWORD" ]]; then
  echo "Define una contraseña en GRAFANA_ADMIN_PASSWORD antes de ejecutar este script."
  exit 1
fi

kubectl apply -f "$ROOT_DIR/k8s/namespace.yaml"

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values "$ROOT_DIR/k8s/monitoring-values.yaml" \
  --set grafana.adminPassword="$GRAFANA_ADMIN_PASSWORD" \
  --wait \
  --timeout 10m

kubectl apply -f "$ROOT_DIR/k8s/pushgateway.yaml"
kubectl apply -f "$ROOT_DIR/k8s/servicemonitor.yaml"

kubectl -n monitoring create configmap microservicio-dashboard \
  --from-file=microservicio.json="$ROOT_DIR/monitoring/grafana/dashboards/microservicio.json" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n monitoring label configmap microservicio-dashboard grafana_dashboard=1 --overwrite

kubectl -n monitoring rollout status deployment/prometheus-pushgateway --timeout=180s
kubectl -n monitoring get pods
