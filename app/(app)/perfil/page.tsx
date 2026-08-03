import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ETIQUETA_ROL, ROLES_GESTION } from "@/lib/solicitud-estado";
import { Tarjeta } from "@/components/ui/superficie";
import FormularioFirma from "./formulario-firma";

export const metadata = { title: "Mi perfil · Kontrol" };

/**
 * Perfil de quien gestiona entregas.
 *
 * Existe por la firma: gestión aparece como «quien entrega» en todas las
 * actas, y no hay forma razonable de que firme a mano cada una. Los datos de
 * la cuenta (nombre, RUT, rol) se muestran para referencia pero se editan en
 * Usuarios, que es donde vive la administración de cuentas.
 */
export default async function MiPerfil() {
  const sesion = await requerirRol(...ROLES_GESTION);

  const usuario = await db.usuario.findUnique({
    where: { id: sesion.id },
    select: {
      nombre: true,
      username: true,
      rut: true,
      rol: true,
      firmaPngUrl: true,
      brigada: { select: { nombre: true } },
    },
  });

  if (!usuario) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="titulo-pagina">Mi perfil</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Tu firma para los documentos de entrega que emites.
        </p>
      </div>

      <Tarjeta>
        <h2 className="titulo-seccion mb-3">Datos de la cuenta</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-tinta-suave">Nombre</dt>
          <dd className="font-medium">{usuario.nombre}</dd>

          <dt className="text-tinta-suave">Usuario</dt>
          <dd className="font-mono text-xs">{usuario.username}</dd>

          <dt className="text-tinta-suave">RUT</dt>
          <dd className="font-mono tabular-nums">{usuario.rut ?? "—"}</dd>

          <dt className="text-tinta-suave">Rol</dt>
          <dd>{ETIQUETA_ROL[usuario.rol]}</dd>

          <dt className="text-tinta-suave">Brigada</dt>
          <dd>{usuario.brigada?.nombre ?? "—"}</dd>
        </dl>
        <p className="mt-3 border-t border-borde pt-3 text-xs text-tinta-tenue">
          Estos datos los administra un administrador desde Usuarios. El RUT
          aparece junto a tu firma en las actas, así que conviene tenerlo
          cargado.
        </p>
      </Tarjeta>

      <FormularioFirma firmaActual={usuario.firmaPngUrl} />
    </div>
  );
}
