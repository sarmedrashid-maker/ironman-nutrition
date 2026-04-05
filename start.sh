#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Check for .env ────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
    echo "IMPORTANT: Edit .env and add your ANTHROPIC_API_KEY before using NLP features."
  fi
fi

# ── Backend ───────────────────────────────────────────────────────────────────
echo ""
echo "Setting up backend..."
cd "$SCRIPT_DIR/backend"

# Create virtualenv if needed
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt -q

# Load .env for seeding
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs) 2>/dev/null || true
fi

python seed.py

# Start backend
echo "Starting backend on http://localhost:8000 ..."
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# ── Frontend ──────────────────────────────────────────────────────────────────
echo ""
echo "Setting up frontend..."
cd "$SCRIPT_DIR/frontend"

npm install --silent

echo "Starting frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  Ironman Nutrition Tracker is running!"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  API docs:  http://localhost:8000/docs"
echo "======================================================"
echo "  Press Ctrl+C to stop."
echo ""

# Trap Ctrl+C and kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait $BACKEND_PID $FRONTEND_PID
