import type { Rol } from "@/generated/prisma/enums";
import type { IconoNav } from "@/components/nav-principal";

/**
 * Dónde vive cada cosa en Kontrol.
 *
 * La navegación se reparte en tres superficies —la barra lateral, el menú de la
 * cuenta y el cajón del teléfono— y antes se armaba a mano en el layout, con la
 * lista plana viajando tal cual a todas. Con diez destinos eso se desincroniza
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
  { id: "cargos", href: "/configuracion/cargos", texto: "Cargos", icono: "cargos", grupo: "configuracion", roles: SOLO_ADMIN },
  { id: "empresas", href: "/configuracion/empresas", texto: "Empresas", icono: "empresas", grupo: "configuracion", roles: SOLO_ADMIN },
  { id: "api", href: "/configuracion/api", texto: "API", icono: "api", grupo: "configuracion", roles: SOLO_ADMIN },
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
  cargos: "Qué hace cada persona en terreno: liniero, prevencionista, jefe de zona.",
  empresas: "Las organizaciones que separan los datos del sistema.",
  api: "Tokens para que otro sistema consulte los datos, solo lectura.",
};

/**
 * Si a este rol le corresponde ver la fila de pestañas de configuración. Con una
 * sola área, una pestaña única no dice nada y solo ocupa alto.
 */
export function llevaPestanas(usuario: UsuarioNav): boolean {
  return destinosDeGrupo(usuario, "configuracion").length > 1;
}

// ── Panel con barra lateral (0.13.0) ─────────────────────────────────────

/** Un grupo de la barra lateral, listo para pintarse. */
export type GrupoLateral = {
  grupo: GrupoNav;
  titulo: string;
  /** Si el rótulo del grupo lleva a un índice (Configuración del admin). */
  hrefTitulo: string | null;
  destinos: Destino[];
};

/**
 * Lo que va en la barra lateral izquierda.
 *
 * A diferencia de la píldora de antes —que no admitía más de cinco destinos en
 * una línea y obligaba a repartirlos entre la barra, el menú del nombre y una
 * entrada única de configuración—, la barra lateral tiene alto de sobra: cada
 * rol ve todos sus destinos, agrupados por naturaleza. Quedan fuera solo los
 * que tienen sitio propio arriba a la derecha: las notificaciones (la campana)
 * y el perfil (el menú de la persona).
 *
 * El rótulo «Configuración» enlaza al índice cuando hay más de un área: es la
 * misma regla de `entradaConfiguracion`, ahora como encabezado del grupo.
 */
export function lateralDe(usuario: UsuarioNav): GrupoLateral[] {
  const fuera = new Set(["notificaciones", "perfil"]);
  return gruposDe(usuario)
    .map((g) => ({
      grupo: g.grupo,
      titulo: g.titulo,
      hrefTitulo: g.grupo === "configuracion" && llevaPestanas(usuario) ? "/configuracion" : null,
      destinos: g.destinos.filter((d) => !fuera.has(d.id)),
    }))
    .filter((g) => g.destinos.length > 0);
}

/**
 * El menú de la persona, arriba a la derecha: datos de la cuenta y ajustes.
 *
 * Lleva lo que es de uno —perfil y firma, equipamiento, documentos— más el
 * acceso a la configuración para quien la tiene. Repite a propósito algunos
 * destinos de la barra lateral: es el sitio donde la gente busca «mi cuenta»,
 * y en el teléfono es el único menú a mano sin abrir el cajón.
 */
export function ajustesDe(usuario: UsuarioNav): Destino[] {
  const personales = destinosDeGrupo(usuario, "personal").filter(
    (d) => d.id !== "notificaciones",
  );
  const configuracion = entradaConfiguracion(usuario);
  return [...personales, ...(configuracion ? [configuracion] : [])];
}
