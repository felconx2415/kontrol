import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES_ADMIN } from "@/lib/solicitud-estado";
import { Tabla } from "@/components/ui/tabla";
import FormularioBrigada from "./formulario-brigada";
import FilaBrigada from "./fila-brigada";

export const metadata = { title: "Brigadas · Kontrol" };

export default async function AdminBrigadas() {
  // Las brigadas definen a quién supervisa quién, así que se administran con el
  // mismo requisito que las cuentas: exclusivo de ADMIN.
  await requerirRol(...ROLES_ADMIN);

  const [brigadas, supervisores] = await Promise.all([
    db.brigada.findMany({
      orderBy: { nombre: "asc" },
      include: {
        supervisor: { select: { nombre: true } },
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
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Brigadas</h1>
        <p className="text-sm text-tinta-suave">
          Crea brigadas, asígnales un supervisor y elimina las que ya no operan.
          Los integrantes se asignan desde la ficha de cada usuario.
        </p>
      </div>

      <FormularioBrigada supervisores={supervisores} />

      <Tabla
        encabezados={[
          "Brigada",
          "Supervisor",
          "Miembros",
          "Solicitudes",
          { texto: "Acciones", alineado: "der" },
        ]}
        anchoMinimo="44rem"
      >
        {brigadas.map((b) => (
          <FilaBrigada
            key={b.id}
            brigada={{
              id: b.id,
              nombre: b.nombre,
              supervisorId: b.supervisorId,
              supervisorNombre: b.supervisor?.nombre ?? null,
              miembros: b._count.miembros,
              solicitudes: b._count.solicitudes,
            }}
            supervisores={supervisores}
          />
        ))}
      </Tabla>
    </div>
  );
}
