#!/usr/bin/env bash
# Dasturkhon — pull latest, install, migrate, build, restart.
# Run from the repo root on the server:  ./deploy/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "▶ Pulling latest from main…"
git pull origin main

echo "▶ Backend: install + migrate (Postgres prod schema)…"
cd "$APP_DIR/server"
npm install --omit=dev
# Use the prod (Postgres) schema explicitly so we never touch the tracked
# schema.prisma file (keeps `git pull` clean). Prisma auto-loads server/.env.
npx prisma generate --schema=prisma/schema.prod.prisma
npx prisma db push --schema=prisma/schema.prod.prisma

echo "▶ Frontend: install + build…"
cd "$APP_DIR"
npm install
npm run build   # outputs dist/  (served by Caddy)

echo "▶ Restarting API service…"
sudo systemctl restart dasturkhon-api

echo "✅ Deploy complete. Check: https://dasturkhon.uz  ·  logs: journalctl -u dasturkhon-api -f"
