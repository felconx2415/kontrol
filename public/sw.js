/**
 * Service worker de Kontrol.
 *
 * Lo que hace: que la app abra con su propio icono, sin barra del navegador, y
 * que al quedarse sin señal muestre una pantalla propia en vez del dinosaurio.
 *
 * Lo que **no** hace, a propósito: guardar páginas ni datos. Kontrol es
 * multiusuario y va detrás de sesión; en un teléfono que se presta —cosa normal
 * en una cuadrilla— una página cacheada podría mostrarle a alguien el
 * equipamiento, el RUT o el acta de otro. Y aunque no se prestara, una solicitud
 * servida desde caché mostraría un estado viejo justo donde la exactitud
 * importa. Así que:
 *
 *   - Navegaciones  → siempre a la red; si falla, la pantalla de sin conexión.
 *   - Estáticos     → desde caché (llevan hash en el nombre, no cambian nunca).
 *   - Todo lo demás → a la red, sin tocar.
 *
 * Guardar datos para consultarlos sin señal es un paso aparte, con su propia
 * decisión sobre qué se puede dejar escrito en el teléfono.
 */

// Al subir la versión, `activate` borra las cachés anteriores. Es el único
// mando para invalidar todo si algo queda mal guardado.
const VERSION = "kontrol-v1";
const ESTATICOS = `${VERSION}-estaticos`;

const SIN_CONEXION = "/sin-conexion.html";

/** Se precarga lo mínimo para poder responder sin red. */
const IMPRESCINDIBLES = [
  SIN_CONEXION,
  "/logo-kontrol.png",
  "/iconos/kontrol-192.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(ESTATICOS)
      .then((cache) => cache.addAll(IMPRESCINDIBLES))
      // Entra en servicio de inmediato: si esperara a que se cierren todas las
      // pestañas, una versión nueva podría tardar días en tomar el relevo.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter((c) => c.startsWith("kontrol-") && !c.startsWith(VERSION))
            .map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Recursos con hash en la ruta: el contenido de una URL no cambia jamás. */
function esEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/iconos/") ||
    url.pathname.startsWith("/fuentes/") ||
    url.pathname.endsWith("/logo-kontrol.png") ||
    url.pathname.endsWith("/logo-kontrol-oscuro.png")
  );
}

/**
 * Rutas que no se tocan ni de lejos: archivos privados de cada persona (firmas,
 * fotos, actas) y las dos APIs. Cachearlas sería filtrarlas.
 */
function esPrivado(url) {
  return (
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/api/")
  );
}

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;

  // Las Server Actions viajan como POST a la misma URL de la página. Tocarlas
  // rompería enviar una solicitud o firmar una entrega, así que solo se mira
  // el tráfico de lectura.
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);

  // Otro origen, o algo privado: que siga su camino sin pasar por aquí.
  if (url.origin !== self.location.origin) return;
  if (esPrivado(url)) return;

  if (esEstatico(url)) {
    evento.respondWith(
      caches.match(peticion).then(
        (guardado) =>
          guardado ??
          fetch(peticion).then((respuesta) => {
            // Solo se guarda lo que llegó bien; una respuesta parcial o un 404
            // cacheados dejarían la app rota hasta la próxima versión.
            if (respuesta.ok) {
              const copia = respuesta.clone();
              caches.open(ESTATICOS).then((cache) => cache.put(peticion, copia));
            }
            return respuesta;
          }),
      ),
    );
    return;
  }

  // Navegación: siempre a la red, para no mostrar nunca una página de otro ni
  // un estado viejo. Sin señal, la pantalla propia.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      fetch(peticion).catch(() => caches.match(SIN_CONEXION)),
    );
  }
});
