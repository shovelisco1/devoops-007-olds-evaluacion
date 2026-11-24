#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_REGION="${AWS_REGION:-us-east-1}"
EKS_CLUSTER_NAME="${EKS_CLUSTER_NAME:-devops-ep3}"
ECR_REPOSITORY="${ECR_REPOSITORY:-microservicio-evaluacion}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "$ROOT_DIR" rev-parse --short HEAD)}"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"

aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION"

if ! aws ecr describe-repositories --repository-names "$ECR_REPOSITORY" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws ecr create-repository --repository-name "$ECR_REPOSITORY" --region "$AWS_REGION" >/dev/null
fi

aws ecr get-login-password --region "$AWS_REGION" | docker login \
  --username AWS \
  --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker build --pull --tag "$IMAGE_URI" "$ROOT_DIR"
docker push "$IMAGE_URI"

kubectl apply -f "$ROOT_DIR/k8s/namespace.yaml"
sed "s|IMAGE_URI_PLACEHOLDER|${IMAGE_URI}|g" "$ROOT_DIR/k8s/app.yaml" | kubectl apply -f -
kubectl rollout status deployment/microservicio -n microservicio --timeout=180s

printf '\nImagen publicada y desplegada: %s\n' "$IMAGE_URI"
kubectl get deployments,services,pods -n microservicio
