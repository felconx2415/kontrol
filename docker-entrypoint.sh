#!/bin/sh
# Arranque del contenedor Kontrol:
#  - siempre aplica migraciones pendientes (seguro/idempotente)
#  - en el PRIMER arranque (marcador en el volumen /data) crea la cuenta admin
#    y carga el codigario; en reinicios NO se repite, para no pisar ediciones
#    manuales del catálogo.
set -e

mkdir -p /data /app/public/uploads

echo "[kontrol] Aplicando migraciones…"
npx prisma migrate deploy

if [ ! -f /data/.inicializado ]; then
  echo "[kontrol] Primer arranque: creando cuenta admin…"
  npm run db:seed
  echo "[kontrol] Cargando codigario (Codigario.xlsx)…"
  npm run db:import || echo "[kontrol] Aviso: no se cargó el codigario (¿falta Codigario.xlsx?)."
  touch /data/.inicializado
else
  echo "[kontrol] Ya inicializado; se omite seed/import."
fi

echo "[kontrol] Iniciando servidor en :${PORT:-3000}…"
exec "$@"
