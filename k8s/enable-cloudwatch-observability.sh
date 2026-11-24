#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
EKS_CLUSTER_NAME="${EKS_CLUSTER_NAME:-devops-ep3}"
ROLE_NAME="${CLOUDWATCH_IAM_ROLE_NAME:-AmazonEKS_Observability_Role}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION"
eksctl utils associate-iam-oidc-provider --cluster "$EKS_CLUSTER_NAME" --region "$AWS_REGION" --approve

eksctl create iamserviceaccount \
  --cluster "$EKS_CLUSTER_NAME" \
  --region "$AWS_REGION" \
  --namespace amazon-cloudwatch \
  --name cloudwatch-agent \
  --role-name "$ROLE_NAME" \
  --role-only \
  --attach-policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy \
  --attach-policy-arn arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess \
  --approve

aws eks create-addon \
  --cluster-name "$EKS_CLUSTER_NAME" \
  --addon-name amazon-cloudwatch-observability \
  --service-account-role-arn "$ROLE_ARN" \
  --region "$AWS_REGION"

aws eks describe-addon \
  --cluster-name "$EKS_CLUSTER_NAME" \
  --addon-name amazon-cloudwatch-observability \
  --region "$AWS_REGION" \
  --query 'addon.status' \
  --output text
