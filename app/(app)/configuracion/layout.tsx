import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { destinosDeGrupo, llevaPestanas } from "@/lib/navegacion";
import PestanasConfiguracion from "@/components/pestanas-configuracion";

/**
 * Guard de toda la sección, para que un área nueva no nazca desprotegida. Cada
 * página endurece el requisito por su cuenta si le corresponde: catálogo es de
 * gestión, pero usuarios, brigadas y empresas exigen además el rol ADMIN.
 *
 * Antes esto vivía en /admin, un nombre que engañaba: el catálogo nunca fue de
 * administración. «Configuración» dice lo que hay: lo que se define una vez y
 * después solo se consulta.
 */
export default async function LayoutConfiguracion({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requerirRol(...ROLES_GESTION);

  const areas = destinosDeGrupo(usuario, "configuracion");

  return (
    <div className="space-y-5">
      {/* Con una sola área —el caso del gestor— una pestaña suelta no dice nada
          y solo ocupa alto. Desde lg tampoco van: la barra lateral ya lista
          las mismas áreas bajo «Configuración», y repetirlas arriba eran dos
          menús iguales a la vista. En el teléfono siguen, porque ahí la barra
          lateral es un cajón cerrado. */}
      {llevaPestanas(usuario) && (
        <div className="lg:hidden">
          <PestanasConfiguracion
            pestanas={areas.map((a) => ({
              id: a.id,
              href: a.href,
              texto: a.texto,
            }))}
          />
        </div>
      )}

      {children}
    </div>
  );
}
