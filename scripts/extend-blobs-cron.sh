#!/usr/bin/env bash
# extend-blobs-cron.sh — VPS host wrapper for blob extension via Docker.
#
# Cron-friendly: detects if container is running, delegates to extend_blobs.sh
# inside the container via docker compose exec.
#
# Usage (from VPS host):
#   bash scripts/extend-blobs-cron.sh
#
# Cron entry:
#   0 8 * * * cd /home/user/cortex && bash scripts/extend-blobs-cron.sh >> /var/log/cortex-extend.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_TAG="[cortex-extend]"

echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $LOG_TAG Starting blob extension check..."

cd "$PROJECT_DIR"

# Check if Docker container is running
if command -v docker >/dev/null 2>&1 && docker compose ps 2>/dev/null | grep -q 'Up'; then
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $LOG_TAG Container is running — delegating to extend_blobs.sh inside container"
    docker compose exec -T cortex-dev bash /workspace/scripts/extend_blobs.sh --do
else
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $LOG_TAG Container not running — checking host cache only"

    CACHE_DIR="$PROJECT_DIR/agent/.cortex/cache"
    if [ -d "$CACHE_DIR" ]; then
        BLOB_COUNT=$(ls -1 "$CACHE_DIR" 2>/dev/null | wc -l | tr -d ' ')
        echo "$LOG_TAG Found $BLOB_COUNT cached blob(s) on host (walrus CLI not available — start container to extend)"
    else
        echo "$LOG_TAG No cache directory — nothing to do"
    fi
fi

echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $LOG_TAG Done."
