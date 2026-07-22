import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES_ADMIN } from "@/lib/solicitud-estado";
import { Tabla } from "@/components/ui/tabla";
import FormularioUsuario from "./formulario-usuario";
import FilaUsuario from "./fila-usuario";

export const metadata = { title: "Usuarios · Kontrol" };

export default async function AdminUsuarios() {
  // Administrar cuentas es exclusivo de ADMIN, más estricto que el layout de
  // /admin, que solo exige un rol de gestión.
  const actual = await requerirRol(...ROLES_ADMIN);

  const [usuarios, brigadas] = await Promise.all([
    db.usuario.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: { brigada: { select: { nombre: true } } },
    }),
    db.brigada.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Usuarios</h1>
        <p className="text-sm text-tinta-suave">
          Crea cuentas, edita sus datos, restablece contraseñas y controla el
          acceso al sistema.
        </p>
      </div>

      <FormularioUsuario brigadas={brigadas} />

      <Tabla
        encabezados={[
          "Nombre",
          "Usuario",
          "Rol",
          "Brigada",
          "Estado",
          { texto: "Acciones", alineado: "der" },
        ]}
        anchoMinimo="52rem"
      >
        {usuarios.map((u) => (
          <FilaUsuario
            key={u.id}
            usuario={{
              id: u.id,
              nombre: u.nombre,
              username: u.username,
              rut: u.rut,
              rol: u.rol,
              brigadaId: u.brigadaId,
              brigadaNombre: u.brigada?.nombre ?? null,
              activo: u.activo,
            }}
            brigadas={brigadas}
            esUsuarioActual={u.id === actual.id}
          />
        ))}
      </Tabla>
    </div>
  );
}
