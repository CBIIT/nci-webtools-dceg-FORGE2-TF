#!/usr/bin/env bash
# FORGE2-TF dev: launch a tuned one-shot S3->EFS sync as a Fargate task.
#
# Run this from AWS CloudShell (default CloudShell is fine — it only makes API
# calls; the container itself runs inside the dev VPC) or from a laptop with the
# dceg profile. The Fargate task is fully detached: it keeps running after
# CloudShell expires or you log out.
#
# What it does:
#   1. Clones the existing dev-forge2-tf-sync task definition
#   2. Patches it: 2 vCPU / 4 GB + tuned S3 transfer settings (CRT client,
#      64 concurrent requests, multipart tuning) + stall timeouts so it fails
#      instead of hanging forever (the prod task hung exactly that way)
#   3. Registers the patched revision
#   4. Runs it with the web service's own subnets/security groups
#   5. Prints the commands to monitor it
set -euo pipefail

# Drop stale exported session creds (they override profiles -> ExpiredToken),
# then use the dceg profile when present (laptop); CloudShell uses its own creds.
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_SECURITY_TOKEN
if aws configure list-profiles 2>/dev/null | grep -qx dceg; then
  export AWS_PROFILE=dceg
fi

TIER="${TIER:-dev}"
APP="forge2-tf"
AWS_REGION="${AWS_REGION:-us-east-1}"
# dev/qa use the nonprod bucket+account; stage/prod the prod ones.
case "${TIER}" in
  stage|prod) DEFAULT_BUCKET="nci-cbiit-dceg-data-prod";    EXPECT_ACCT="113394061914" ;;
  *)          DEFAULT_BUCKET="nci-cbiit-dceg-data-nonprod"; EXPECT_ACCT="201624419975" ;;
esac
S3_BUCKET="${S3_BUCKET:-${DEFAULT_BUCKET}}"
SYNC_TASK="${TIER}-${APP}-sync"
PARAM_PATH="/analysistools/${TIER}/${APP}"
TASK_CPU="2048"
TASK_MEM="4096"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }

ACCT=$(aws sts get-caller-identity --query Account --output text)
if [ "${ACCT}" != "${EXPECT_ACCT}" ]; then
  log "ERROR: tier '${TIER}' lives in account ${EXPECT_ACCT}, but you are in ${ACCT}."
  log "Open CloudShell in the right account (or fix TIER) and rerun."
  exit 1
fi
log "AWS account ${ACCT} matches tier ${TIER}"

CLUSTER=$(aws ssm get-parameter --name "${PARAM_PATH}/ecs_cluster" --query Parameter.Value --output text)
WEB_SERVICE=$(aws ssm get-parameter --name "${PARAM_PATH}/ecs_web_service" --query Parameter.Value --output text)
log "cluster ${CLUSTER}, network template from service ${WEB_SERVICE}"

# Tuned container command: perf settings first, then both syncs.
# --no-progress keeps logs sane; read/connect timeouts prevent indefinite hangs.
SYNC_CMD=$(cat <<EOF
aws configure set default.s3.preferred_transfer_client crt &&
aws configure set default.s3.target_bandwidth 10Gb/s &&
aws configure set default.s3.max_concurrent_requests 64 &&
aws configure set default.s3.max_queue_size 10000 &&
aws configure set default.s3.multipart_threshold 64MB &&
aws configure set default.s3.multipart_chunksize 16MB &&
echo "=== tuned sync start \$(date) ===" &&
aws s3 sync "s3://${S3_BUCKET}/${APP}/data/" /data/ --no-progress --cli-read-timeout 300 --cli-connect-timeout 60 &&
aws s3 sync "s3://${S3_BUCKET}/${APP}/motif-logos/" /motif-logos/ --no-progress --cli-read-timeout 300 --cli-connect-timeout 60 &&
echo "=== SYNC COMPLETE \$(date) ==="
EOF
)

log "cloning task definition ${SYNC_TASK} and patching cpu=${TASK_CPU} mem=${TASK_MEM}"
aws ecs describe-task-definition --task-definition "${SYNC_TASK}" \
  --query taskDefinition --output json \
| jq --arg cpu "${TASK_CPU}" --arg mem "${TASK_MEM}" --arg cmd "${SYNC_CMD}" '
    del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
        .compatibilities, .registeredAt, .registeredBy, .deregisteredAt)
    | .cpu = $cpu | .memory = $mem
    | .containerDefinitions[0].command = [$cmd]' \
> /tmp/${SYNC_TASK}-tuned.json

NEW_TD=$(aws ecs register-task-definition \
  --cli-input-json "file:///tmp/${SYNC_TASK}-tuned.json" \
  --query 'taskDefinition.taskDefinitionArn' --output text)
log "registered ${NEW_TD}"

# Reuse the web service's awsvpc network configuration (same subnets/SGs,
# which already reach the EFS mount targets and S3).
NETCONF=$(aws ecs describe-services --cluster "${CLUSTER}" --services "${WEB_SERVICE}" \
  --query 'services[0].networkConfiguration' --output json)

TASK_ARN=$(aws ecs run-task \
  --cluster "${CLUSTER}" \
  --task-definition "${NEW_TD}" \
  --launch-type FARGATE \
  --network-configuration "${NETCONF}" \
  --started-by "manual-tuned-sync-$(date +%Y%m%d%H%M)" \
  --query 'tasks[0].taskArn' --output text)
TASK_ID="${TASK_ARN##*/}"

log "task started: ${TASK_ARN}"
log "it is detached — CloudShell can expire, the task keeps running."
echo
echo "Monitor status (done = STOPPED with exit 0):"
echo "  aws ecs describe-tasks --cluster ${CLUSTER} --tasks ${TASK_ID} \\"
echo "    --query 'tasks[0].{status:lastStatus,exit:containers[0].exitCode,reason:stoppedReason}' --output table"
echo
echo "Tail logs (look for '=== SYNC COMPLETE ==='):"
echo "  aws logs tail /analysistools/${TIER}/${APP}/sync --follow --format short"
