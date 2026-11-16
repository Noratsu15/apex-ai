#!/usr/bin/env bash
# start-cerebro.sh — Arranca el cerebro Python (FastAPI) si no está activo.
#
# Uso (entorno de desarrollo; en Vercel el servicio se despliega aparte):
#   bash scripts/start-cerebro.sh
#
# Si Python no tiene las dependencias, sale sin error: la app web usará el
# respaldo TypeScript automáticamente (ver src/lib/brain.ts).

set -u

PUERTO="${CEREBRO_PUERTO:-8000}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ¿Ya está activo?
if curl -sf "http://127.0.0.1:${PUERTO}/health" >/dev/null 2>&1; then
  exit 0
fi

# Buscar un intérprete Python con las dependencias del cerebro
PY=""
for candidato in \
  "$RAIZ/backend/.venv/bin/python" \
  "/home/z/.venv/bin/python" \
  "$(command -v python3 || true)"; do
  if [ -n "$candidato" ] && [ -x "$candidato" ] && \
     "$candidato" -c "import fastapi, uvicorn, httpx, docx" >/dev/null 2>&1; then
    PY="$candidato"
    break
  fi
done

if [ -z "$PY" ]; then
  echo "[start-cerebro] Python sin dependencias; instala con: pip install -r backend/requirements.txt" >&2
  echo "[start-cerebro] La app usará el respaldo TypeScript." >&2
  exit 0
fi

cd "$RAIZ/backend"
nohup "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$PUERTO" >> /tmp/cerebro.log 2>&1 &
echo "[start-cerebro] Cerebro Python iniciado (PID $!) en el puerto ${PUERTO}"
