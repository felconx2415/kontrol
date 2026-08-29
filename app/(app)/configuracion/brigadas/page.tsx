import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES_ADMIN } from "@/lib/solicitud-estado";
import { buscador } from "@/lib/busqueda";
import { Tabla } from "@/components/ui/tabla";
import { Aviso, Vacio } from "@/components/ui/superficie";
import Buscador from "@/components/ui/buscador";
import FormularioBrigada from "./formulario-brigada";
import FilaBrigada from "./fila-brigada";

export const metadata = { title: "Brigadas · Kontrol" };

export default async function AdminBrigadas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Las brigadas definen a quién supervisa quién, así que se administran con el
  // mismo requisito que las cuentas: exclusivo de ADMIN.
  await requerirRol(...ROLES_ADMIN);

  const { q } = await searchParams;

  const [brigadas, supervisores, empresas] = await Promise.all([
    db.brigada.findMany({
      orderBy: [{ empresa: { nombre: "asc" } }, { nombre: "asc" }],
      include: {
        supervisor: { select: { nombre: true } },
        empresa: { select: { nombre: true } },
        _count: { select: { miembros: true, solicitudes: true } },
      },
    }),
    // Cualquier cuenta activa puede supervisar; el rol define permisos sobre
    // solicitudes, no la jefatura de la brigada. Se incluyen además los
    // supervisores ya asignados aunque estén inactivos: si faltaran de la lista,
    // el select del panel de edición caería en "Sin supervisor" y guardar un
    // cambio de nombre borraría la asignación sin querer.
    db.usuario.findMany({
      where: { OR: [{ activo: true }, { brigadasSupervisadas: { some: {} } }] },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, activo: true },
    }),
    db.empresa.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, activa: true },
    }),
  ]);

  const hayEmpresas = empresas.some((e) => e.activa);

  // Se busca también por empresa y por supervisor: «las brigadas de Forestal
  // Sur» y «las que lleva Rojas» son las dos preguntas que se hacen aquí, y
  // ambas columnas están a la vista en la tabla.
  const coincide = buscador(q);
  const filtradas = brigadas.filter((b) =>
    coincide(b.nombre, b.empresa.nombre, b.supervisor?.nombre),
  );
  const buscando = Boolean(q?.trim());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Brigadas</h1>
        <p className="text-sm text-tinta-suave">
          Crea brigadas, asígnales un supervisor y elimina las que ya no operan.
          Los integrantes se asignan desde la ficha de cada usuario.
        </p>
      </div>

      {/* Sin empresa activa no hay dónde crear una brigada, y un formulario que
          solo puede fallar no ayuda: se dice qué falta y dónde. */}
      {hayEmpresas ? (
        <FormularioBrigada supervisores={supervisores} empresas={empresas} />
      ) : (
        <Aviso tono="espera">
          Antes de crear brigadas necesitas al menos una empresa activa. Crea
          una en <Link href="/configuracion/empresas" className="underline underline-offset-2">Empresas</Link>.
        </Aviso>
      )}

      <Buscador
        etiqueta="Buscar brigada"
        placeholder="Nombre, empresa o supervisor…"
        valor={q ?? ""}
        accion="/configuracion/brigadas"
        resumen={
          buscando
            ? `${filtradas.length} de ${brigadas.length} brigadas`
            : undefined
        }
      />

      {filtradas.length === 0 ? (
        <Vacio
          mensaje={
            buscando
              ? "Ninguna brigada coincide con esa búsqueda. Prueba con parte del nombre, la empresa o el supervisor."
              : "Todavía no hay brigadas. Crea la primera para poder asignarle gente."
          }
        />
      ) : (
        <Tabla
          encabezados={[
            "Brigada",
            "Empresa",
            "Tipo",
            "Supervisor",
            "Miembros",
            "Solicitudes",
            { texto: "Acciones", alineado: "der" },
          ]}
          anchoMinimo="56rem"
        >
          {filtradas.map((b) => (
            <FilaBrigada
              key={b.id}
              brigada={{
                id: b.id,
                nombre: b.nombre,
                tipo: b.tipo,
                empresaId: b.empresaId,
                empresaNombre: b.empresa.nombre,
                supervisorId: b.supervisorId,
                supervisorNombre: b.supervisor?.nombre ?? null,
                miembros: b._count.miembros,
                solicitudes: b._count.solicitudes,
              }}
              supervisores={supervisores}
              empresas={empresas}
            />
          ))}
        </Tabla>
      )}
    </div>
  );
}
