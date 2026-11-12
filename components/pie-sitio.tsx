import { version } from "@/package.json";

/**
 * Pie del sitio.
 *
 * Lleva la versión de la app porque, en terreno, cuando alguien reporta que
 * «no le aparece el botón», lo primero que hay que saber es qué versión está
 * viendo: el navegador puede tener cacheada una anterior.
 *
 * Mantiene la tipografía de la app en vez de la del diseño original: el
 * `* { font-family }` de aquel fragmento habría pisado la fuente de todas las
 * pantallas, no solo la del pie.
 */
export default function PieSitio() {
  return (
    <footer className="no-print mt-auto w-full bg-marca-950 py-4 text-center text-sm text-white/70">
      {/* Mismo ancho que el contenido: con justify-around a todo el ancho de la
          pantalla, el pie no se alineaba con nada de lo que tenía encima. */}
      <div className="mx-auto flex max-w-[110rem] flex-col items-center justify-between gap-3 px-4 md:flex-row lg:px-8">
      <p>
        Kontrol{" "}
        {/* Una versión estable («0.7.0») se muestra tal cual. Si vuelve a haber
            una preliminar, semver la escribe con guion («0.8.0-beta») y aquí se
            separa con un espacio: el guion no aporta nada al leerla. */}
        <span className="font-mono tabular-nums text-white/50">
          v{version.replace("-", " ")}
        </span>
        {" · "}
        <span className="text-white/50">
          © {new Date().getFullYear()} Todos los derechos reservados
        </span>
      </p>

      <div className="flex items-center gap-4">
        <a
          href="https://felserv.cl"
          target="_blank"
          rel="noopener noreferrer"
          className="foco-anillo-claro rounded transition-colors duration-150 hover:text-white"
        >
          Potenciado por <span className="font-medium">felserv</span>
        </a>

        <div className="h-8 w-px bg-white/20" />

        <a
          href="https://felserv.cl/privacidad.php"
          target="_blank"
          rel="noopener noreferrer"
          className="foco-anillo-claro rounded transition-colors duration-150 hover:text-white"
        >
          Privacidad
        </a>
      </div>
    </div>
    </footer>
  );
}
