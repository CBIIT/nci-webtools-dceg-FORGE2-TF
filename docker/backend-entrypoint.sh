#!/bin/sh
# Backend container entrypoint.
#
# Two supported topologies share this image:
#
#   1. Serverless / Fargate: there is no host to bind-mount config.json from, so
#      the ECS task definition supplies the values as environment variables and
#      this script materializes /deploy/server/config.json before the Node app
#      (which does `require('./config.json')`) starts.
#
#   2. Local dev / EC2 (docker-compose): config.json is bind-mounted into
#      /deploy/server/config.json (often read-only). In that case we MUST NOT
#      try to overwrite it -- we detect the existing file and use it as-is, so
#      the legacy "run local as before" flow keeps working unchanged.
#
# AWS credentials are intentionally left blank when rendering: on Fargate the
# ECS task role provides them automatically to aws-sdk / boto3 via the container
# credential endpoint. For local runs, credentials are passed via environment.
set -e

CONFIG_PATH=/deploy/server/config.json

if [ -f "$CONFIG_PATH" ]; then
  # Bind-mounted (local/EC2) config present -- respect it, never clobber.
  echo "Using existing $CONFIG_PATH (bind-mounted); skipping env render."
else
  : "${SERVER_PORT:=8000}"
  : "${CLIENT_FOLDER:=../client/build}"
  : "${LOGS_FOLDER:=/deploy/logs}"
  : "${LOG_LEVEL:=info}"
  : "${DATA_FOLDER:=/deploy/data}"
  : "${TMP_FOLDER:=/deploy/tmp}"
  : "${AWS_REGION:=us-east-1}"
  : "${S3_BUCKET:=nci-cbiit-dceg-dev}"
  : "${S3_SUBFOLDER:=forge2-tf}"

  # Ensure runtime directories exist (DATA_FOLDER is the EFS mount on Fargate;
  # the others are task-local ephemeral storage).
  mkdir -p "$LOGS_FOLDER" "$TMP_FOLDER" "$DATA_FOLDER"

  cat > "$CONFIG_PATH" <<EOF
{
  "server": {
    "port": ${SERVER_PORT},
    "client": "${CLIENT_FOLDER}"
  },
  "logs": {
    "folder": "${LOGS_FOLDER}",
    "level": "${LOG_LEVEL}"
  },
  "data": {
    "folder": "${DATA_FOLDER}"
  },
  "tmp": {
    "folder": "${TMP_FOLDER}"
  },
  "aws": {
    "region": "${AWS_REGION}",
    "aws_access_key_id": "",
    "aws_secret_access_key": "",
    "s3": {
      "bucket": "${S3_BUCKET}",
      "subFolder": "${S3_SUBFOLDER}"
    }
  }
}
EOF

  echo "Rendered $CONFIG_PATH from environment:"
  cat "$CONFIG_PATH"
fi

exec npm start
