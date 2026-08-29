import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES_ADMIN } from "@/lib/solicitud-estado";
import { buscador } from "@/lib/busqueda";
import { Tabla } from "@/components/ui/tabla";
import { Vacio } from "@/components/ui/superficie";
import Buscador from "@/components/ui/buscador";
import FormularioEmpresa from "./formulario-empresa";
import FilaEmpresa from "./fila-empresa";

export const metadata = { title: "Empresas · Kontrol" };

export default async function AdminEmpresas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // La empresa decide quién ve qué en todo el sistema, así que administrarla es
  // exclusivo de ADMIN, igual que las cuentas.
  await requerirRol(...ROLES_ADMIN);

  const { q } = await searchParams;

  const empresas = await db.empresa.findMany({
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
    include: {
      _count: { select: { miembros: true, brigadas: true, solicitudes: true } },
    },
  });

  const coincide = buscador(q);
  const filtradas = empresas.filter((e) => coincide(e.nombre, e.rut));
  const buscando = Boolean(q?.trim());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Empresas</h1>
        <p className="text-sm text-tinta-suave">
          Cada empresa ve solo lo suyo: sus solicitudes, su bodega y su gente.
          Las cuentas se asignan desde la ficha de cada usuario; un gestor puede
          atender más de una.
        </p>
      </div>

      <FormularioEmpresa />

      <Buscador
        etiqueta="Buscar empresa"
        placeholder="Nombre o RUT…"
        valor={q ?? ""}
        accion="/configuracion/empresas"
        resumen={
          buscando ? `${filtradas.length} de ${empresas.length} empresas` : undefined
        }
      />

      {filtradas.length === 0 ? (
        <Vacio
          mensaje={
            buscando
              ? "Ninguna empresa coincide con esa búsqueda. Prueba con parte del nombre o el RUT."
              : "Todavía no hay empresas. Crea la primera para poder dar de alta cuentas y brigadas."
          }
        />
      ) : (
        <Tabla
          encabezados={[
            "Empresa",
            "RUT",
            "Personas",
            "Brigadas",
            "Solicitudes",
            "Estado",
            { texto: "Acciones", alineado: "der" },
          ]}
          anchoMinimo="52rem"
        >
          {filtradas.map((e) => (
            <FilaEmpresa
              key={e.id}
              empresa={{
                id: e.id,
                nombre: e.nombre,
                rut: e.rut,
                activa: e.activa,
                personas: e._count.miembros,
                brigadas: e._count.brigadas,
                solicitudes: e._count.solicitudes,
              }}
            />
          ))}
        </Tabla>
      )}
    </div>
  );
}
