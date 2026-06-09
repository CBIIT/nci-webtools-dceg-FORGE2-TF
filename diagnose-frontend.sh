#!/usr/bin/env bash
#
# diagnose-frontend.sh — check what the frontend actually returns for the app
# page and a static asset, both from the host and from inside the container.
# A "CORS error" on a same-origin asset almost always means a non-200 status,
# a redirect to a different host/port, or the wrong content-type.
#
set -uo pipefail
cd "$(dirname "$0")"

CONTAINER="forge2-tf-frontend-fargate"
BASE="http://localhost:8102"
ASSET="/forge2-tf/assets/js/bootstrap-slider.min.js"

hr() { printf '%s\n' "------------------------------------------------------------------"; }

echo "=================================================================="
echo "1) HOST -> $BASE/forge2-tf/  (status, redirects, content-type)"
hr
curl -sS -D - -o /dev/null -L "$BASE/forge2-tf/" 2>&1 | sed -n '1,20p' || true

echo
echo "=================================================================="
echo "2) HOST -> $BASE$ASSET  (status + content-type; should be 200 + a js type)"
hr
curl -sS -D - -o /dev/null "$BASE$ASSET" 2>&1 | sed -n '1,15p' || true

echo
echo "=================================================================="
echo "3) CONTAINER: is the asset actually in the built site?"
hr
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker exec "$CONTAINER" sh -c 'ls -la /var/www/html/forge2-tf/ | head -30'
  echo
  echo "asset file:"
  docker exec "$CONTAINER" sh -c "ls -la /var/www/html/forge2-tf/assets/js/bootstrap-slider.min.js 2>&1 || echo 'NOT BUILT INTO IMAGE'"
  echo
  echo "fetch from inside the container (rules out host port/proxy issues):"
  docker exec "$CONTAINER" sh -c "curl -sS -D - -o /dev/null http://localhost:80$ASSET 2>&1 | sed -n '1,12p' || true"
else
  echo "Container '$CONTAINER' not running. Start with: ./run-docker.sh -d"
fi

echo
echo "=================================================================="
echo "4) Recent Apache error log lines"
hr
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker exec "$CONTAINER" sh -c 'tail -n 20 /var/log/httpd/error_log 2>/dev/null || echo "(no error_log; logs go to container stdout)"'
fi

echo
echo "=================================================================="
echo "INTERPRETATION"
hr
cat <<'EOF'
- (2)/(3) status 200 + content-type text/javascript (or application/javascript),
  and the file exists in the image -> the asset is fine; the "CORS" messages in
  the console are the THIRD-PARTY scripts in index.html (code.jquery.com with
  crossorigin+SRI, assets.adobedtm.com, googletagmanager.com, cdn.jsdelivr.net)
  being blocked on your network. Those are external and unrelated to the app.
- (2) is a 3xx redirect to a different host/port -> Apache canonical-name issue;
  we'll pin ServerName. Paste the Location header.
- (2) is 404 or "NOT BUILT INTO IMAGE" -> the client build didn't include the
  asset; rebuild with ./run-docker.sh down && ./run-docker.sh (no cache if needed:
  docker compose -f docker-compose-local.yml build --no-cache forge2-tf-frontend).
- (2) is 200 but content-type text/html -> Apache served a fallback/error page as
  the asset; paste the output and we'll fix the vhost.
EOF
