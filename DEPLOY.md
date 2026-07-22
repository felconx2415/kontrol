# Despliegue de Kontrol (Docker + Caddy)

Guía para montar Kontrol en un servidor **ARM** con Docker, detrás de **Caddy**,
en `https://epp.rmsgestion.cl`, **sin chocar con las otras apps del servidor**.

La estrategia: Kontrol corre en un contenedor que **no publica ningún puerto al
host**. Caddy lo alcanza por la red interna de Docker (`kontrol:3000`). Así los
únicos puertos usados en el host son el 80/443 de Caddy, que ya tienes.

---

## 0) Detectar cómo corre tu Caddy

Ejecuta esto en el servidor y quédate con el resultado:

```bash
# ¿Caddy es un contenedor Docker?
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -i caddy

# Redes de Docker (para saber a cuál conectar Kontrol)
docker network ls

# Si Caddy es contenedor, ver a qué red(es) está conectado:
docker inspect <NOMBRE_CONTENEDOR_CADDY> \
  -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}'

# ¿O Caddy corre en el host (systemd)?
systemctl status caddy 2>/dev/null | head -3 ; which caddy

# Puertos ya ocupados en el host (para no repetir):
ss -tlnp | grep -E ':(80|443|3000|8080|8087)' || sudo ss -tlnp | grep -E ':(80|443)'
```

- **Caddy en Docker** → sigue la **Opción A** (recomendada).
- **Caddy en el host** → sigue la **Opción B**.

---

## 1) Preparar el proyecto

```bash
git clone git@github.com:felconx2415/kontrol.git
cd kontrol

cp .env.example .env
# Edita .env:  SESSION_SECRET (obligatorio) y ADMIN_PASSWORD.
# Genera el secreto:
openssl rand -base64 32
```

Pega ese valor en `SESSION_SECRET=` dentro de `.env`.

---

## Opción A — Caddy en Docker (recomendada)

Kontrol se une a la **misma red** que Caddy y no expone puertos.

1. Averigua el nombre de la red de Caddy (paso 0). Ponlo en `docker-compose.yml`,
   en la sección `networks:` (`name: <la-red-de-caddy>`). Si prefieres una red
   dedicada, créala y conéctale también Caddy:
   ```bash
   docker network create web         # si no existe
   docker network connect web <contenedor_caddy>
   ```

2. Levanta Kontrol (la primera vez compila la imagen; en ARM puede tardar):
   ```bash
   docker compose up -d --build
   docker compose logs -f kontrol     # verás: migraciones → admin → codigario
   ```

3. Añade el sitio a tu **Caddyfile** (el que ya usa Caddy) y recarga:
   ```caddy
   epp.rmsgestion.cl {
       reverse_proxy kontrol:3000
   }
   ```
   Recargar Caddy (según cómo lo tengas):
   ```bash
   docker exec <contenedor_caddy> caddy reload --config /etc/caddy/Caddyfile
   ```

---

## Opción B — Caddy en el host

Kontrol publica el puerto **solo en loopback** y Caddy proxea a `127.0.0.1`.

1. En `docker-compose.yml`: **comenta** la clave `networks:` del servicio y la
   sección `networks:` del final, y **descomenta** el bloque `ports:`
   (usa el puerto de `KONTROL_HOST_PORT` en `.env`, por defecto `8087`; cámbialo
   si está ocupado según el paso 0).

2. Levanta:
   ```bash
   docker compose up -d --build
   ```

3. En tu Caddyfile del host:
   ```caddy
   epp.rmsgestion.cl {
       reverse_proxy 127.0.0.1:8087
   }
   ```
   ```bash
   sudo systemctl reload caddy   # o: caddy reload
   ```

---

## 2) Verificar

- DNS: `epp.rmsgestion.cl` debe apuntar (A/AAAA) a la IP del servidor. Caddy
  saca el certificado TLS solo al primer acceso.
- Abre `https://epp.rmsgestion.cl` y entra con **admin / (la clave de `.env`)**.
  **Cambia la contraseña** desde Usuarios apenas entres.

## Datos y persistencia

- **`kontrol_data`** (volumen): base SQLite en `/data/kontrol.db`.
- **`kontrol_uploads`** (volumen): firmas, fotos y actas.
- Respaldo rápido:
  ```bash
  docker run --rm -v kontrol_data:/d -v "$PWD":/b alpine \
    sh -c 'cp /d/kontrol.db /b/kontrol-backup.db'
  ```

## Operación

```bash
# Actualizar a una versión nueva
git pull && docker compose up -d --build

# Recargar el codigario manualmente (tras actualizar el Excel)
docker compose exec kontrol npm run db:import

# Ver logs
docker compose logs -f kontrol
```

> Primer arranque = automático: aplica migraciones, crea el admin y carga el
> codigario. En reinicios posteriores solo aplica migraciones (no re-siembra),
> gracias al marcador `/data/.inicializado`.
