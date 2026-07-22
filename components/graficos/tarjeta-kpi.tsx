import Link from "next/link";
import type { Kpi } from "@/lib/metricas";

/**
 * Cifra destacada con su línea de contexto.
 *
 * El contexto no es decorativo: un número suelto ("3") no dice si es bueno o
 * malo. La alerta se marca con texto además del color, nunca solo con color.
 */
export default function TarjetaKpi({ kpi }: { kpi: Kpi }) {
  return (
    <Link
      href={kpi.href}
      className={`foco-anillo flex flex-col justify-between rounded-xl border bg-panel p-4 transition-colors duration-150 hover:bg-panel-suave ${
        kpi.alerta ? "border-espera-borde" : "border-borde"
      }`}
    >
      <p className="text-sm text-tinta-suave">{kpi.etiqueta}</p>
      <p className="dato-grande mt-2 text-tinta">{kpi.valor}</p>
      <p
        className={`mt-1 text-xs ${kpi.alerta ? "font-medium text-espera" : "text-tinta-tenue"}`}
      >
        {kpi.alerta && <span aria-hidden="true">▲ </span>}
        {kpi.contexto}
      </p>
    </Link>
  );
}
