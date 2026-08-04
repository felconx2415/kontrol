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

# Zona horaria del contenedor. Sin esto Node corre en UTC y toda cuenta hecha
# en hora local —cuándo vence un EPP, en qué mes cae— se corre unas horas. El
# formato de lo que se muestra ya fija America/Santiago por su cuenta
# (ZONA_HORARIA en lib/vencimientos.ts); esto alinea además los cálculos.
ENV TZ=America/Santiago

# Dependencias (capa cacheable): solo cambia si cambian los manifiestos.
COPY package.json package-lock.json ./
RUN npm ci

# Chromium para imprimir las actas en PDF. El formato de acta se maqueta en
# HTML/CSS y se imprime con Playwright, así que el navegador es parte del
# runtime, no una herramienta de desarrollo. `--with-deps` instala además las
# bibliotecas de sistema que Chromium necesita en Debian.
#
# Es lo que más pesa de la imagen (~400 MB) y lo que más tarda en compilar en
# ARM; va en su propia capa para que solo se rehaga si cambia Playwright.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/*

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
