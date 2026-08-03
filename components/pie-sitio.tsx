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
    <footer className="no-print mt-auto flex w-full flex-col items-center justify-around gap-3 bg-marca-950 px-4 py-4 text-center text-sm text-white/70 md:flex-row">
      <p>
        Kontrol{" "}
        {/* package.json exige semver («0.5.3-beta»), pero el guion no aporta
            nada al leerlo: en pantalla se separa la etiqueta con un espacio. */}
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
    </footer>
  );
}
