import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES_ADMIN } from "@/lib/solicitud-estado";
import { buscador } from "@/lib/busqueda";
import { Tabla } from "@/components/ui/tabla";
import { Vacio } from "@/components/ui/superficie";
import Buscador from "@/components/ui/buscador";
import FormularioCargo from "./formulario-cargo";
import FilaCargo from "./fila-cargo";

export const metadata = { title: "Cargos · Kontrol" };

export default async function AdminCargos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Mismo requisito que brigadas y empresas: el cargo encasilla a la gente y
  // se administra desde la misma mesa que las cuentas.
  await requerirRol(...ROLES_ADMIN);

  const { q } = await searchParams;

  const cargos = await db.cargo.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: { _count: { select: { personas: true } } },
  });

  const coincide = buscador(q);
  const filtrados = cargos.filter((c) => coincide(c.nombre));
  const buscando = Boolean(q?.trim());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Cargos</h1>
        <p className="text-sm text-tinta-suave">
          Qué hace cada persona en terreno: liniero, prevencionista de riesgo,
          jefe de zona. Es distinto del rol, que dice qué puede hacer dentro de
          Kontrol. El cargo se asigna en la ficha de cada cuenta y sale en el
          acta de entrega.
        </p>
      </div>

      <FormularioCargo />

      <Buscador
        etiqueta="Buscar cargo"
        placeholder="Nombre del cargo…"
        valor={q ?? ""}
        accion="/configuracion/cargos"
        resumen={buscando ? `${filtrados.length} de ${cargos.length} cargos` : undefined}
      />

      {filtrados.length === 0 ? (
        <Vacio
          mensaje={
            buscando
              ? "Ningún cargo coincide con esa búsqueda. Prueba con parte del nombre."
              : "Todavía no hay cargos. Crea el primero para poder asignarlo en las fichas."
          }
        />
      ) : (
        <Tabla
          encabezados={[
            "Cargo",
            "Personas",
            "Estado",
            { texto: "Acciones", alineado: "der" },
          ]}
          anchoMinimo="40rem"
        >
          {filtrados.map((c) => (
            <FilaCargo
              key={c.id}
              cargo={{
                id: c.id,
                nombre: c.nombre,
                activo: c.activo,
                personas: c._count.personas,
              }}
            />
          ))}
        </Tabla>
      )}
    </div>
  );
}
