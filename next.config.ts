import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir el dev server desde otros dispositivos de la red local
  // (p. ej. un teléfono entrando por http://192.168.1.19:3000). Sin esto,
  // Next 16 bloquea las peticiones dev de origen cruzado y React no llega a
  // hidratar: la página se ve, pero los botones (como el menú móvil) no
  // responden. El comodín cubre cambios de IP dentro de la misma subred.
  allowedDevOrigins: ["192.168.1.19", "192.168.1.*"],

  // Servimos imágenes tal cual (firmas, fotos), sin el optimizador de Next:
  // son pocas y pequeñas, y así no dependemos de `sharp` en producción ni de
  // que el optimizador alcance la ruta que las sirve.
  images: { unoptimized: true },

  // Playwright lanza Chromium desde node_modules y resuelve rutas propias en
  // tiempo de ejecución: empaquetarlo lo rompe. Se deja fuera del bundle del
  // servidor para que se cargue como módulo de Node normal.
  serverExternalPackages: ["playwright"],

  // /admin pasó a /configuracion. El nombre viejo engañaba: el catálogo nunca
  // fue de administración —lo lleva gestión— y convivía con tres pantallas que
  // sí son exclusivas del ADMIN.
  //
  // El orden importa: `articulos` además cambió de nombre, así que su regla
  // tiene que resolverse antes que el comodín.
  async redirects() {
    return [
      {
        source: "/admin/articulos",
        destination: "/configuracion/catalogo",
        permanent: true,
      },
      {
        source: "/admin/:ruta*",
        destination: "/configuracion/:ruta*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
