import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFecha } from "@/lib/vencimientos";
import { cantidadConUnidad } from "@/lib/unidades";
import { alcanza } from "@/lib/alcance";
import Insignia from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/superficie";
import { ListaPanel } from "@/components/ui/tabla";

export const metadata = { title: "Equipamiento de la brigada · Kontrol" };

/**
 * Qué tiene una brigada a su nombre.
 *
 * Es la contraparte de `/historial/[usuarioId]`: hay material que es de la
 * cuadrilla —la motosierra, la carpa, el botiquín— y no de ninguno de sus
 * integrantes, así que necesita una ficha propia. Sin ella, ese equipamiento
 * quedaba a nombre del liniero que fue a buscarlo y se iba con él al cambiar
 * de brigada, en el papel pero no en la realidad.
 */
export default async function EquipamientoBrigada({
  params,
}: {
  params: Promise<{ brigadaId: string }>;
}) {
  const actual = await requerirUsuario();
  const { brigadaId } = await params;

  const brigada = await db.brigada.findUnique({
    where: { id: brigadaId },
    include: {
      empresa: { select: { nombre: true } },
      supervisor: { select: { id: true, nombre: true } },
      miembros: {
        where: { activo: true },
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, cargo: { select: { nombre: true } } },
      },
    },
  });

  if (!brigada) notFound();

  // La ve su propia gente y quien alcance a la empresa. Un solicitante de otra
  // cuadrilla no tiene nada que hacer aquí, aunque sea de la misma empresa.
  const esMiBrigada = actual.brigadaId === brigada.id;
  if (!esMiBrigada && !alcanza(actual.alcance, brigada.empresaId)) {
    redirect("/escritorio?error=sin-permiso");
  }
  if (actual.rol === "SOLICITANTE" && !esMiBrigada) {
    redirect("/escritorio?error=sin-permiso");
  }

  // Las líneas y no las entregas: lo que se quiere ver es qué tiene la brigada,
  // aunque varias cosas hayan salido en la misma acta.
  const asignaciones = await db.asignacionItem.findMany({
    where: { asignacion: { brigadaId: brigada.id } },
    orderBy: { asignacion: { asignadoEn: "desc" } },
    include: {
      item: { select: { nombre: true, codigo: true, unidad: true } },
      asignacion: {
        select: {
          id: true,
          asignadoEn: true,
          notas: true,
          firmaPngUrl: true,
          asignadoPor: { select: { nombre: true } },
          retiradoPor: { select: { nombre: true } },
          retiradoPorNombre: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">{brigada.nombre}</h1>
        <p className="text-sm text-tinta-suave">
          {brigada.empresa.nombre} · {asignaciones.length} ítem
          {asignaciones.length === 1 ? "" : "s"} a nombre de la brigada
          {brigada.supervisor ? ` · supervisa ${brigada.supervisor.nombre}` : ""}
        </p>
      </div>

      <section>
        <h2 className="titulo-seccion mb-2">Equipamiento de la brigada</h2>

        {asignaciones.length === 0 ? (
          <Vacio mensaje="Esta brigada todavía no tiene equipamiento a su nombre. Se le asigna desde la bodega." />
        ) : (
          <ListaPanel>
            {asignaciones.map((a) => {
              const retiro =
                a.asignacion.retiradoPor?.nombre ?? a.asignacion.retiradoPorNombre;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{a.item.nombre}</p>
                    <p className="text-xs text-tinta-tenue">
                      {a.item.codigo} · {cantidadConUnidad(a.cantidad, a.item.unidad)}
                      {a.numeroSerie ? ` · serie ${a.numeroSerie}` : ""} · entregado{" "}
                      {formatearFecha(a.asignacion.asignadoEn)} por{" "}
                      {a.asignacion.asignadoPor.nombre}
                      {/* Quién vino a buscarlo: es de quien es la firma del
                          acta, y sin nombrarlo la firma no dice de quién es. */}
                      {retiro ? ` · retiró ${retiro}` : ""}
                      {a.asignacion.notas ? ` · ${a.asignacion.notas}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.asignacion.firmaPngUrl && (
                      <a
                        href={`/api/bodega/asignaciones/${a.asignacion.id}/acta`}
                        className="foco-anillo rounded text-xs text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta"
                      >
                        Acta de entrega
                      </a>
                    )}
                    <Insignia clases="bg-marca-50 text-marca-700 ring-marca-200">
                      Bodega
                    </Insignia>
                  </div>
                </li>
              );
            })}
          </ListaPanel>
        )}
      </section>

      <section>
        <h2 className="titulo-seccion mb-2">
          Integrantes ({brigada.miembros.length})
        </h2>
        <p className="mb-2 text-sm text-tinta-suave">
          Lo que tiene cada uno a su nombre va en su propia ficha: esto es solo
          lo de la brigada.
        </p>

        {brigada.miembros.length === 0 ? (
          <Vacio mensaje="Esta brigada no tiene integrantes activos." />
        ) : (
          <ListaPanel>
            {brigada.miembros.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/historial/${m.id}`}
                  className="foco-anillo flex min-h-11 flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-marca-50"
                >
                  <span className="text-sm font-medium">{m.nombre}</span>
                  <span className="text-xs text-tinta-tenue">
                    {m.cargo?.nombre ?? "Sin cargo"}
                  </span>
                </Link>
              </li>
            ))}
          </ListaPanel>
        )}
      </section>
    </div>
  );
}
