#!/bin/bash
# Data Report Generator — launch script
# Starts backend + frontend dev servers, then opens the browser

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Data Report Generator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Kill any stale servers from a previous run
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 0.5

# Start both dev servers in the background
cd "$PROJECT_DIR"
npm run dev &
DEV_PID=$!

echo "⏳  Waiting for backend..."
for i in {1..30}; do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✓  Backend ready"
    break
  fi
  sleep 1
done

echo "⏳  Waiting for frontend..."
for i in {1..15}; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✓  Frontend ready"
    break
  fi
  sleep 1
done

echo ""
echo "  → http://localhost:5173"
echo ""
open http://localhost:5173

# Keep window open so you can see server logs
wait $DEV_PID
