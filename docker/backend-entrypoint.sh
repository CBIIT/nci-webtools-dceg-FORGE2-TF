#!/bin/sh
# Render config.json from env (Fargate), or keep an existing bind-mounted
# config.json (local/EC2). AWS creds come from the task role.
set -e

CONFIG_PATH=/deploy/server/config.json

if [ -f "$CONFIG_PATH" ]; then
  echo "Using existing $CONFIG_PATH (bind-mounted); skipping env render."
else
  : "${SERVER_PORT:=8000}"
  : "${CLIENT_FOLDER:=../client/build}"
  : "${LOG_LEVEL:=info}"
  : "${DATA_FOLDER:=/deploy/data}"
  : "${TMP_FOLDER:=/deploy/data/tmp}"
  : "${AWS_REGION:=us-east-1}"
  : "${S3_BUCKET:=nci-cbiit-dceg-dev}"
  : "${S3_SUBFOLDER:=forge2-tf}"

  mkdir -p "$TMP_FOLDER" "$DATA_FOLDER"

  cat > "$CONFIG_PATH" <<EOF
{
  "server": {
    "port": ${SERVER_PORT},
    "client": "${CLIENT_FOLDER}"
  },
  "logs": {
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
