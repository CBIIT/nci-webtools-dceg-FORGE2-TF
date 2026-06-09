#!/usr/bin/env bash
#
# diagnose-data.sh — figure out why the backend can't see /deploy/data contents.
# Compares: (1) the host data folder, (2) the bind-mount source Docker actually
# attached to the running container, and (3) what the container sees inside.
#
set -uo pipefail
cd "$(dirname "$0")"

CONTAINER="forge2-tf-backend-fargate"
HOST_DATA="$(pwd)/data"
REL="All/fp/filtered_sample_aggregates.json"

echo "=================================================================="
echo "1) HOST: expected data dir = $HOST_DATA"
echo "------------------------------------------------------------------"
if [ -d "$HOST_DATA" ]; then
  echo "Top level of host data dir:"
  ls -la "$HOST_DATA"
  echo
  if [ -f "$HOST_DATA/$REL" ]; then
    echo "OK   host has: $HOST_DATA/$REL"
  else
    echo "MISS host does NOT have: $HOST_DATA/$REL"
    echo "     -> the file is not in THIS folder. Find where it really is:"
    echo "        find \"$(pwd)\" -name filtered_sample_aggregates.json 2>/dev/null"
    find "$(pwd)" -name 'filtered_sample_aggregates.json' 2>/dev/null | sed 's/^/        found: /' || true
  fi
else
  echo "MISS host data dir does not exist at all."
fi

echo
echo "=================================================================="
echo "2) DOCKER: bind-mount source actually attached to '$CONTAINER'"
echo "------------------------------------------------------------------"
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker inspect -f '{{range .Mounts}}{{println .Type "  src=" .Source "  ->  dst=" .Destination}}{{end}}' "$CONTAINER"
  echo
  echo "Container created at: $(docker inspect -f '{{.Created}}' "$CONTAINER")"
else
  echo "Container '$CONTAINER' is not running. Start it with: ./run-docker.sh -d"
fi

echo
echo "=================================================================="
echo "3) CONTAINER: what the backend sees at /deploy/data"
echo "------------------------------------------------------------------"
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ls /deploy/data:"
  docker exec "$CONTAINER" ls -la /deploy/data || true
  echo
  echo "test for $REL inside container:"
  if docker exec "$CONTAINER" test -f "/deploy/data/$REL"; then
    echo "OK   container sees /deploy/data/$REL"
  else
    echo "MISS container does NOT see /deploy/data/$REL"
  fi
fi

echo
echo "=================================================================="
echo "INTERPRETATION"
echo "------------------------------------------------------------------"
cat <<'EOF'
- If (1) MISS: the file isn't in <project>/data — move/stage it there (the path
  shown by `find` above tells you where it currently is).
- If (1) OK but (2) src= is some OTHER path (or a Docker *volume*, not your
  project/data): the container was created before the mount was fixed.
  Recreate it:   ./run-docker.sh down && ./run-docker.sh -d
- If (1) OK and (2) src=<project>/data but (3) MISS / empty: Docker Desktop is
  not sharing this path. Docker Desktop > Settings > Resources > File Sharing,
  add the folder, Apply & Restart, then ./run-docker.sh down && ./run-docker.sh -d
EOF
