import type { Rol } from "@/generated/prisma/enums";
import type { IconoNav } from "@/components/nav-principal";
import { esGestion } from "@/lib/solicitud-estado";

/**
 * Dónde vive cada cosa en Kontrol.
 *
 * La navegación se reparte en tres superficies —la barra, el menú del nombre y
 * el cajón del teléfono— y antes se armaba a mano en el layout, con la lista
 * plana viajando tal cual a las tres. Con diez destinos eso se desincroniza
 * solo: basta agregar uno y olvidarse de una superficie.
 *
 * Aquí se declara una vez y cada superficie deriva lo suyo. Es el mismo trato
 * que `lib/solicitud-estado.ts` le da a las transiciones y `lib/alcance.ts` a
 * las empresas: la regla vive en un módulo y la interfaz la consulta.
 */

/**
 * De qué naturaleza es un destino. No es una etiqueta decorativa: decide en qué
 * superficie aparece, porque el problema que esto viene a resolver es
 * justamente que las tres compartían fila.
 */
export type GrupoNav = "trabajo" | "personal" | "configuracion";

export const ETIQUETA_GRUPO: Record<GrupoNav, string> = {
  trabajo: "Mi trabajo",
  personal: "Lo mío",
  configuracion: "Configuración",
};

export type Destino = {
  id: string;
  /** Puede llevar `:id`, que `destinosDe` sustituye por el del usuario. */
  href: string;
  texto: string;
  icono: IconoNav;
  grupo: GrupoNav;
  roles: Rol[];
};

const TODOS: Rol[] = ["SOLICITANTE", "APROBADOR", "GESTOR", "ADMIN"];
const GESTION: Rol[] = ["GESTOR", "ADMIN"];
const SOLO_ADMIN: Rol[] = ["ADMIN"];

/**
 * Todos los destinos del sistema, en el orden en que se muestran.
 *
 * `href` con `:id` se sustituye por el id de quien mira (ver `destinosDe`): el
 * historial es una sola pantalla que sirve para ver el equipamiento de
 * cualquiera, y «Mi equipamiento» es esa misma pantalla apuntando a uno mismo.
 */
const DESTINOS: Destino[] = [
  { id: "escritorio", href: "/escritorio", texto: "Escritorio", icono: "escritorio", grupo: "trabajo", roles: TODOS },
  { id: "solicitudes", href: "/solicitudes", texto: "Solicitudes", icono: "solicitudes", grupo: "trabajo", roles: TODOS },
  { id: "bodega", href: "/bodega", texto: "Bodega", icono: "bodega", grupo: "trabajo", roles: GESTION },
  { id: "reportes", href: "/reportes", texto: "Reportes", icono: "reportes", grupo: "trabajo", roles: GESTION },

  { id: "equipamiento", href: "/historial/:id", texto: "Mi equipamiento", icono: "equipamiento", grupo: "personal", roles: TODOS },
  { id: "documentos", href: "/documentos", texto: "Mis documentos", icono: "documentos", grupo: "personal", roles: TODOS },
  { id: "notificaciones", href: "/notificaciones", texto: "Notificaciones", icono: "notificaciones", grupo: "personal", roles: TODOS },
  // Solo gestión firma los documentos que emite, así que solo ella tiene perfil.
  { id: "perfil", href: "/perfil", texto: "Mi perfil y firma", icono: "perfil", grupo: "personal", roles: GESTION },

  { id: "catalogo", href: "/configuracion/catalogo", texto: "Catálogo", icono: "catalogo", grupo: "configuracion", roles: GESTION },
  { id: "usuarios", href: "/configuracion/usuarios", texto: "Usuarios", icono: "usuarios", grupo: "configuracion", roles: SOLO_ADMIN },
  { id: "brigadas", href: "/configuracion/brigadas", texto: "Brigadas", icono: "brigadas", grupo: "configuracion", roles: SOLO_ADMIN },
  { id: "empresas", href: "/configuracion/empresas", texto: "Empresas", icono: "empresas", grupo: "configuracion", roles: SOLO_ADMIN },
];

/** Lo mínimo que hace falta saber de quien mira para armarle la navegación. */
export type UsuarioNav = { id: string; rol: Rol };

/** Los destinos que le corresponden a este usuario, con el href ya resuelto. */
export function destinosDe(usuario: UsuarioNav): Destino[] {
  return DESTINOS.filter((d) => d.roles.includes(usuario.rol)).map((d) => ({
    ...d,
    href: d.href.replace(":id", usuario.id),
  }));
}

export function destinosDeGrupo(usuario: UsuarioNav, grupo: GrupoNav): Destino[] {
  return destinosDe(usuario).filter((d) => d.grupo === grupo);
}

/**
 * Los destinos de la barra superior.
 *
 * Lleva **lo que ese rol usa a diario**, y por eso lo personal se coloca según
 * el rol en vez de tener un sitio fijo: en terreno «Mi equipamiento» es la razón
 * de ser de la app y esconderlo tras un menú sería un retroceso, mientras que a
 * gestión —que casi no tiene EPP a su nombre— solo le ocupa sitio. Quien no es
 * gestión no tiene Bodega ni Reportes, así que le sobra espacio de sobra.
 *
 * La configuración entra como **una** entrada, no como cuatro. Ver
 * `entradaConfiguracion`.
 */
export function barraDe(usuario: UsuarioNav): Destino[] {
  const trabajo = destinosDeGrupo(usuario, "trabajo");

  const personales = esGestion(usuario.rol)
    ? []
    : destinosDeGrupo(usuario, "personal").filter(
        // La campana ya cubre las notificaciones y el perfil no es de estos
        // roles: a la barra solo suben los dos destinos de uso diario.
        (d) => d.id === "equipamiento" || d.id === "documentos",
      );

  const configuracion = entradaConfiguracion(usuario);

  return [...trabajo, ...personales, ...(configuracion ? [configuracion] : [])];
}

/**
 * Los destinos del menú que cuelga del nombre: lo de cada uno.
 *
 * Para quien lleva sus destinos personales en la barra, el menú queda con lo
 * que no cabe ahí (el perfil) o vacío, y en ese caso el layout no lo pinta.
 */
export function menuPersonaDe(usuario: UsuarioNav): Destino[] {
  const personales = destinosDeGrupo(usuario, "personal");

  // Las notificaciones tienen su propia campana al lado: repetirlas aquí sería
  // dos puertas juntas a la misma pieza.
  const sinCampana = personales.filter((d) => d.id !== "notificaciones");

  if (!esGestion(usuario.rol)) {
    // Equipamiento y documentos ya están en su barra.
    return sinCampana.filter(
      (d) => d.id !== "equipamiento" && d.id !== "documentos",
    );
  }
  return sinCampana;
}

/**
 * La entrada de configuración de la barra, adaptada a lo que alcanza el rol.
 *
 * Con una sola área lleva su propio nombre y entra directo —un gestor sigue
 * viendo «Catálogo», igual que siempre—, porque mandarlo a un índice de una
 * tarjeta sería un clic de peaje. Con varias, es «Configuración» y abre el
 * índice. Sin ninguna, no existe.
 */
export function entradaConfiguracion(usuario: UsuarioNav): Destino | null {
  const areas = destinosDeGrupo(usuario, "configuracion");
  if (areas.length === 0) return null;
  if (areas.length === 1) return areas[0];

  return {
    id: "configuracion",
    href: "/configuracion",
    texto: "Configuración",
    icono: "configuracion",
    grupo: "configuracion",
    roles: SOLO_ADMIN,
  };
}

/**
 * Grupos del cajón del teléfono. Ahí caben todos los destinos en vertical, así
 * que no hay que esconder nada: lo que faltaba era el rótulo que separa las tres
 * naturalezas. Los grupos vacíos no se devuelven.
 */
export function gruposDe(
  usuario: UsuarioNav,
): { grupo: GrupoNav; titulo: string; destinos: Destino[] }[] {
  const orden: GrupoNav[] = ["trabajo", "personal", "configuracion"];

  return orden
    .map((grupo) => ({
      grupo,
      titulo: ETIQUETA_GRUPO[grupo],
      destinos: destinosDeGrupo(usuario, grupo),
    }))
    .filter((g) => g.destinos.length > 0);
}

// ── Sección de configuración ──────────────────────────────────────────────

/** Qué hay dentro de cada área, para el índice de /configuracion. */
export const DESCRIPCION_AREA: Record<string, string> = {
  catalogo: "Artículos que se pueden solicitar, con su CECO y vida útil.",
  usuarios: "Cuentas, roles, empresa y brigada de cada persona.",
  brigadas: "Cuadrillas de cada empresa y quién las supervisa.",
  empresas: "Las organizaciones que separan los datos del sistema.",
};

/**
 * Si a este rol le corresponde ver la fila de pestañas de configuración. Con una
 * sola área, una pestaña única no dice nada y solo ocupa alto.
 */
export function llevaPestanas(usuario: UsuarioNav): boolean {
  return destinosDeGrupo(usuario, "configuracion").length > 1;
}
