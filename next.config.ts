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
};

export default nextConfig;
