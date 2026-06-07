#!/usr/bin/env bash
# Run from your Mac to sync + build + restart the GaeDHD presence bridge on the QNAP.
# Mirrors the GaeDHD Telegram bot's deploy. The .env lives on the QNAP and is NOT
# overwritten by this script (rsync excludes it), so set it there once.
set -euo pipefail

REMOTE=what-server
REMOTE_DIR=/share/CACHEDEV1_DATA/Container/gaedhd-presence-bridge
DOCKER="HOME=/tmp/docker-home DOCKER_HOST=unix:///var/run/docker.sock LD_LIBRARY_PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/usr/lib /share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/.libs/docker"

echo "→ Ensuring remote dir exists..."
ssh "$REMOTE" "mkdir -p $REMOTE_DIR"

echo "→ Syncing code..."
rsync -av --exclude=node_modules --exclude=dist --exclude=.git \
  --exclude='*.db' --exclude='*.log' --exclude=.env \
  "$(dirname "$0")/" "$REMOTE:$REMOTE_DIR/"

echo "→ Building + restarting..."
ssh "$REMOTE" "cd $REMOTE_DIR && $DOCKER compose build && $DOCKER compose up -d"

echo "→ Logs (Ctrl+C to exit):"
ssh "$REMOTE" "cd $REMOTE_DIR && $DOCKER compose logs --tail=20 -f"
