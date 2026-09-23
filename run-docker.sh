#!/usr/bin/env bash
#
# run-docker.sh — build and run FORGE2-TF locally (frontend + backend) using the
# local compose topology that mirrors the single-task Fargate deployment.
#
# Usage:
#   ./run-docker.sh            # build images and start in the foreground
#   ./run-docker.sh -d         # build and start detached (background)
#   ./run-docker.sh down       # stop and remove the containers
#   ./run-docker.sh logs       # follow container logs
#
set -euo pipefail

# Always run from the project root (directory of this script).
cd "$(dirname "$0")"

# Export AWS credentials (from the 'dceg' profile) into the environment so the
# backend container can read the S3-hosted tabix archives. Compose passes these
# through as AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN.
eval "$(aws configure export-credentials --profile dceg --format env)"

COMPOSE_FILE="docker-compose-local.yml"
FRONTEND_URL="http://localhost:8102/forge2-tf/"

# Pin the data bind-mount to an ABSOLUTE path under the project root so it never
# depends on the working directory Compose happens to resolve relative paths
# against. The compose file reads ${DATA_DIR}; this guarantees the container's
# /deploy/data is exactly <project>/data.
export DATA_DIR="$(pwd)/data"

# The project data dir may contain symlinks (e.g. data/All -> an external S3 sync
# cache). Bind mounts pass symlinks through verbatim, so the link's TARGET must
# also be visible inside the container at the same absolute path for the link to
# resolve. Detect data/All's target and expose it (compose mounts it at the
# identical path). If data/All is a real dir (no symlink), this is a harmless
# no-op mount of /tmp.
if [ -L "$DATA_DIR/All" ]; then
  _all_target="$(readlink "$DATA_DIR/All")"
  case "$_all_target" in
    /*) DATA_ALL_TARGET="$_all_target" ;;            # absolute symlink target
    *)  DATA_ALL_TARGET="$DATA_DIR/$_all_target" ;;  # relative -> make absolute
  esac
else
  DATA_ALL_TARGET="/tmp"
fi
export DATA_ALL_TARGET

# Resolve the docker compose command (v2 plugin vs legacy v1 binary).
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Error: docker compose (or docker-compose) is not installed." >&2
  exit 1
fi

compose() { "${COMPOSE[@]}" -f "$COMPOSE_FILE" "$@"; }

case "${1:-up}" in
  down)
    compose down --remove-orphans
    exit 0
    ;;
  logs)
    compose logs -f
    exit 0
    ;;
  up|-d)
    # Ensure the local data/log directories that stand in for the EFS mounts
    # exist before bind-mounting them.
    mkdir -p "$DATA_DIR"/motif-logos "$DATA_DIR"/tmp logs

    # Preflight: show exactly what will be mounted at /deploy/data and warn if the
    # expected reference data is missing (the #1 cause of "could not find ... fn").
    echo "Mounting data dir -> /deploy/data : $DATA_DIR"
    if [ "$DATA_ALL_TARGET" != "/tmp" ]; then
      echo "data/All symlink target (mounted at same path): $DATA_ALL_TARGET"
    fi
    SAMPLE_MD="$DATA_DIR/All/fp/filtered_sample_aggregates.json"
    if [ ! -f "$SAMPLE_MD" ]; then
      echo "WARNING: expected reference file not found on host:" >&2
      echo "         $SAMPLE_MD" >&2
      echo "         Stage the reference data into $DATA_DIR before querying." >&2
      echo "         Contents of $DATA_DIR:" >&2
      ls -la "$DATA_DIR" >&2 || true
    fi

    if [ "${1:-up}" = "-d" ]; then
      compose up --build -d
      echo
      echo "Started in the background. App: ${FRONTEND_URL}"
      echo "Follow logs:  $0 logs"
      echo "Stop:         $0 down"
    else
      echo "Building images and starting (Ctrl-C to stop). App will be at: ${FRONTEND_URL}"
      compose up --build
    fi
    ;;
  *)
    echo "Usage: $0 [up|-d|down|logs]" >&2
    exit 1
    ;;
esac
