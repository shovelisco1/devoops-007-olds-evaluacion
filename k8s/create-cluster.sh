#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
EKS_CLUSTER_NAME="${EKS_CLUSTER_NAME:-devops-ep3}"

if ! command -v eksctl >/dev/null 2>&1; then
  echo "No se encontró eksctl. Instálalo antes de continuar."
  exit 1
fi

aws sts get-caller-identity >/dev/null

echo "Se creará un clúster EKS llamado ${EKS_CLUSTER_NAME} en ${AWS_REGION}."
echo "La creación genera cargos de EKS y de los recursos EC2/EBS asociados."
echo "Para cancelar, presiona Ctrl+C ahora."
read -r -p "Escribe CREAR para confirmar: " confirmation
if [[ "$confirmation" != "CREAR" ]]; then
  echo "Operación cancelada."
  exit 0
fi

eksctl create cluster \
  --name "$EKS_CLUSTER_NAME" \
  --region "$AWS_REGION" \
  --nodes 1 \
  --node-type t3.large \
  --managed \
  --nodes-min 1 \
  --nodes-max 1 \
  --with-oidc

aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION"
kubectl get nodes
