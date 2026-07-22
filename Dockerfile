# Kontrol — imagen de producción. Pensada para ARM (arm64) y x86; el módulo
# nativo better-sqlite3 se compila dentro si no hay binario precompilado.
FROM node:22-slim

# Herramientas para compilar módulos nativos (better-sqlite3) si hace falta.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Placeholders de build: el chequeo de SESSION_SECRET corre al importar módulos
# durante `next build`, y Prisma quiere una URL. Los valores REALES se pasan en
# tiempo de ejecución (docker compose), estos solo permiten construir.
# NOTA: NO fijar NODE_ENV=production antes de `npm ci`, o npm omitiría las
# devDependencies (tailwind, typescript, prisma CLI, tsx) que el build necesita.
ENV DATABASE_URL="file:/data/kontrol.db"
ENV SESSION_SECRET="build-time-placeholder-override-en-runtime-32c"
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias (capa cacheable): solo cambia si cambian los manifiestos.
COPY package.json package-lock.json ./
RUN npm ci

# Código y build de Next (incluye `prisma generate`).
COPY . .
RUN npx prisma generate && npm run build

# A partir de aquí, el contenedor corre en modo producción.
ENV NODE_ENV=production

COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["entrypoint.sh"]
CMD ["npm", "run", "start"]
