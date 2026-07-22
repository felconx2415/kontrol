import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";

/**
 * Guard de todo el grupo /admin, para que una ruta nueva no nazca desprotegida.
 * Cada página endurece el requisito por su cuenta si le corresponde: la
 * administración de cuentas (/admin/usuarios) exige además el rol ADMIN.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requerirRol(...ROLES_GESTION);
  return children;
}
