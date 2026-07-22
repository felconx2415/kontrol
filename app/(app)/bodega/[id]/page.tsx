import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import { cantidadConSigno, COLOR_MOVIMIENTO, ETIQUETA_MOVIMIENTO } from "@/lib/bodega";
import Insignia from "@/components/ui/insignia";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { Seccion, Vacio } from "@/components/ui/superficie";

export const metadata = { title: "Ítem de bodega · Kontrol" };

const fechaHora = (d: Date) =>
  d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fecha = (d: Date) =>
  d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

export default async function DetalleItem({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirRol(...ROLES_GESTION);
  const { id } = await params;

  const item = await db.itemBodega.findUnique({
    where: { id },
    include: {
      movimientos: {
        orderBy: { creadoEn: "desc" },
        include: { usuario: { select: { nombre: true } } },
      },
      prestamos: {
        orderBy: { prestadoEn: "desc" },
        select: {
          id: true,
          cantidad: true,
          persona: true,
          estado: true,
          prestadoEn: true,
          devueltoEn: true,
        },
      },
    },
  });

  if (!item) notFound();

  const prestado = item.prestamos
    .filter((p) => p.estado === "ACTIVO")
    .reduce((s, p) => s + p.cantidad, 0);

  const datos = [
    { t: "Código", v: item.codigo, mono: true },
    { t: "Categoría", v: item.categoria },
    { t: "Ubicación", v: item.ubicacion ?? "—" },
    { t: "Stock", v: `${item.stock} ${item.unidad}` },
    { t: "Prestado", v: prestado > 0 ? `${prestado} ${item.unidad}` : "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/bodega"
          className="foco-anillo rounded text-sm text-marca-700 underline-offset-2 hover:underline"
        >
          ← Volver a bodega
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="titulo-pagina">{item.nombre}</h1>
          {!item.activo && (
            <Insignia clases="bg-lienzo text-tinta-tenue ring-borde">Inactivo</Insignia>
          )}
        </div>
        {item.notas && <p className="mt-1 text-sm text-tinta-suave">{item.notas}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {datos.map((d) => (
          <div key={d.t} className="rounded-xl border border-borde bg-panel p-4">
            <dt className="text-xs text-tinta-tenue">{d.t}</dt>
            <dd className={`mt-0.5 font-medium text-tinta ${d.mono ? "font-mono" : ""}`}>
              {d.v}
            </dd>
          </div>
        ))}
      </dl>

      {item.prestamos.length > 0 && (
        <Seccion titulo={`Préstamos (${item.prestamos.length})`} plano>
          <Tabla
            encabezados={[
              "Prestado a",
              { texto: "Cantidad", alineado: "der" },
              "Salida",
              "Estado",
              "Devuelto",
              { texto: "", alineado: "der" },
            ]}
            anchoMinimo="48rem"
          >
            {item.prestamos.map((p) => (
              <Fila key={p.id}>
                <Celda etiqueta="Prestado a">{p.persona}</Celda>
                <Celda etiqueta="Cantidad" derecha mono>
                  {p.cantidad} {item.unidad}
                </Celda>
                <Celda etiqueta="Salida" tenue>
                  {fecha(p.prestadoEn)}
                </Celda>
                <Celda etiqueta="Estado">
                  <Insignia
                    clases={
                      p.estado === "ACTIVO"
                        ? "bg-espera-fondo text-espera ring-espera-borde"
                        : "bg-exito-fondo text-exito ring-exito-borde"
                    }
                  >
                    {p.estado === "ACTIVO" ? "Activo" : "Devuelto"}
                  </Insignia>
                </Celda>
                <Celda etiqueta="Devuelto" tenue>
                  {p.devueltoEn ? fecha(p.devueltoEn) : "—"}
                </Celda>
                <Celda derecha completa>
                  <div className="flex flex-wrap justify-end gap-1">
                    <a
                      href={`/api/bodega/prestamos/${p.id}/acta`}
                      className="foco-anillo inline-flex min-h-11 items-center rounded px-2 text-xs font-medium text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta"
                    >
                      Acta
                    </a>
                    {p.estado === "ACTIVO" && (
                      <Link
                        href={`/bodega/prestamos/${p.id}/devolver`}
                        className="foco-anillo inline-flex min-h-11 items-center rounded px-2 text-xs font-medium text-marca-700 underline underline-offset-2 transition-colors duration-150 hover:text-marca-800"
                      >
                        Devolver
                      </Link>
                    )}
                  </div>
                </Celda>
              </Fila>
            ))}
          </Tabla>
        </Seccion>
      )}

      <Seccion titulo={`Historial de movimientos (${item.movimientos.length})`} plano>
        {item.movimientos.length === 0 ? (
          <div className="p-4">
            <Vacio mensaje="Este ítem aún no tiene movimientos." />
          </div>
        ) : (
          <Tabla
            encabezados={[
              "Fecha",
              "Tipo",
              { texto: "Cantidad", alineado: "der" },
              { texto: "Stock", alineado: "der" },
              "Persona",
              "Registró",
              "Nota",
            ]}
            anchoMinimo="52rem"
          >
            {item.movimientos.map((m) => (
              <Fila key={m.id}>
                <Celda etiqueta="Fecha" tenue>
                  {fechaHora(m.creadoEn)}
                </Celda>
                <Celda etiqueta="Tipo">
                  <Insignia clases={COLOR_MOVIMIENTO[m.tipo]}>
                    {ETIQUETA_MOVIMIENTO[m.tipo]}
                  </Insignia>
                </Celda>
                <Celda etiqueta="Cantidad" derecha mono>
                  {cantidadConSigno(m.tipo, m.cantidad)}
                </Celda>
                <Celda etiqueta="Stock" derecha mono tenue>
                  {m.stockResultante}
                </Celda>
                <Celda etiqueta="Persona" tenue>
                  {m.persona ?? "—"}
                </Celda>
                <Celda etiqueta="Registró" tenue>
                  {m.usuario.nombre}
                </Celda>
                <Celda etiqueta="Nota" tenue>
                  {m.notas ?? "—"}
                </Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Seccion>
    </div>
  );
}
