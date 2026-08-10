import type { MetadataRoute } from "next";

/**
 * Manifiesto de la aplicación instalable.
 *
 * Kontrol se usa en terreno, desde el teléfono, por gente que puede pasar meses
 * entre una solicitud y la siguiente. Pedirles instalar desde Play Store y
 * mantenerla al día en veintitantos equipos es una barrera alta para ese uso;
 * un icono en la pantalla de inicio, no. Esto es lo que lo hace posible.
 *
 * Va como ruta de metadatos (`app/manifest.ts`) y no como JSON suelto para que
 * los colores y el nombre salgan de un solo sitio y no se desincronicen.
 */

/** Los mismos de `globals.css`, resueltos a sRGB: el manifiesto no lee oklch. */
const MARCA_950 = "#031a29"; // la píldora de la barra
const LIENZO = "#f3f5f6"; // el fondo de la app

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kontrol · Equipamiento y EPP",
    // El que se ve bajo el icono: tiene que caber sin cortarse.
    short_name: "Kontrol",
    description:
      "Solicita equipamiento y EPP, revisa lo que tienes asignado y firma tus entregas.",
    lang: "es-CL",
    dir: "ltr",
    start_url: "/escritorio",
    // Al abrirse sin sesión, /escritorio redirige al login; entrar por el
    // escritorio es lo correcto para quien ya la tiene abierta, que es el caso
    // normal de una app instalada.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: LIENZO,
    // Tiñe la barra de estado de Android del color de la barra de la app.
    theme_color: MARCA_950,
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/iconos/kontrol-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/iconos/kontrol-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Android recorta el icono a la forma del sistema (círculo, escudo…), y
      // para eso necesita uno con fondo sólido y la marca dentro del 80%
      // central. Sin este, el recorte se come los bordes del logotipo.
      {
        src: "/iconos/kontrol-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Accesos directos del menú largo sobre el icono. Son los dos destinos que
    // justifican abrir la app en terreno.
    shortcuts: [
      {
        name: "Nueva solicitud",
        short_name: "Solicitar",
        url: "/solicitudes/nueva",
      },
      {
        name: "Mis documentos",
        short_name: "Documentos",
        url: "/documentos",
      },
    ],
  };
}
