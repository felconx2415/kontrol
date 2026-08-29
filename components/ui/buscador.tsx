import Boton, { BotonEnlace } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";

/**
 * Caja de búsqueda por URL (`?q=…`), igual que los filtros de solicitudes y
 * bodega: un GET normal, sin JavaScript de por medio, que sobrevive a recargar
 * la página y se puede compartir por enlace.
 *
 * El formulario no arrastra ningún otro parámetro, y eso es deliberado: al
 * buscar se vuelve a la página 1, que es donde están los resultados.
 */
export default function Buscador({
  etiqueta,
  placeholder,
  valor,
  accion,
  resumen,
}: {
  etiqueta: string;
  placeholder: string;
  /** Término actual: se repone en el campo para no perderlo al recargar. */
  valor: string;
  /** Ruta de la propia página: es el destino del formulario y el de «Limpiar». */
  accion: string;
  /** Cuántas filas quedaron, cuando hay búsqueda activa. */
  resumen?: string;
}) {
  return (
    <form
      action={accion}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-borde bg-panel p-4"
    >
      <Campo etiqueta={etiqueta} htmlFor="q" className="min-w-0 flex-1">
        <Entrada
          id="q"
          type="search"
          name="q"
          defaultValue={valor}
          placeholder={placeholder}
        />
      </Campo>

      <Boton type="submit" variante="secundario" className="mb-0.5">
        Buscar
      </Boton>

      {/* Salir de la búsqueda tiene que costar un toque, no borrar a mano lo
          escrito y volver a enviar. Solo aparece cuando hay algo que limpiar. */}
      {valor.trim() !== "" && (
        <BotonEnlace href={accion} variante="fantasma" className="mb-0.5">
          Limpiar
        </BotonEnlace>
      )}

      {resumen && (
        <p className="w-full text-xs text-tinta-tenue" aria-live="polite">
          {resumen}
        </p>
      )}
    </form>
  );
}
