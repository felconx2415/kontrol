import type { EstadoSolicitud, Motivo, Rol, TipoBrigada } from "@/generated/prisma/enums";

/**
 * Única fuente de verdad del ciclo de vida de una solicitud.
 * La usan tanto la UI (para decidir qué botones mostrar) como las Server
 * Actions (para validar antes de escribir). No duplicar estas reglas.
 */

/**
 * Roles con acceso a la operación completa del sitio (logística, reportes,
 * catálogo). ADMIN incluye todo lo de GESTOR.
 */
export const ROLES_GESTION: Rol[] = ["GESTOR", "ADMIN"];

/** Solo ADMIN administra cuentas de usuario. */
export const ROLES_ADMIN: Rol[] = ["ADMIN"];

export const esGestion = (rol: Rol) => ROLES_GESTION.includes(rol);
export const esAdmin = (rol: Rol) => ROLES_ADMIN.includes(rol);

type Transicion = {
  desde: EstadoSolicitud;
  hacia: EstadoSolicitud;
  roles: Rol[];
  /** Etiqueta del botón que dispara la transición. */
  accion: string;
};

export const TRANSICIONES: Transicion[] = [
  { desde: "BORRADOR", hacia: "PENDIENTE", roles: ["SOLICITANTE", "APROBADOR", "GESTOR", "ADMIN"], accion: "Enviar solicitud" },
  { desde: "PENDIENTE", hacia: "APROBADA", roles: ["APROBADOR", "GESTOR", "ADMIN"], accion: "Aprobar" },
  { desde: "PENDIENTE", hacia: "RECHAZADA", roles: ["APROBADOR", "GESTOR", "ADMIN"], accion: "Rechazar" },
  { desde: "APROBADA", hacia: "EN_GESTION", roles: ["GESTOR", "ADMIN"], accion: "Pedir al almacén" },
  { desde: "EN_GESTION", hacia: "RECIBIDA", roles: ["GESTOR", "ADMIN"], accion: "Marcar recibida" },
  { desde: "RECIBIDA", hacia: "ENTREGADA", roles: ["GESTOR", "ADMIN"], accion: "Entregar y firmar" },
  { desde: "BORRADOR", hacia: "CANCELADA", roles: ["SOLICITANTE", "APROBADOR", "GESTOR", "ADMIN"], accion: "Cancelar" },
  { desde: "PENDIENTE", hacia: "CANCELADA", roles: ["SOLICITANTE", "APROBADOR", "GESTOR", "ADMIN"], accion: "Cancelar" },
  { desde: "APROBADA", hacia: "CANCELADA", roles: ["APROBADOR", "GESTOR", "ADMIN"], accion: "Cancelar" },
  { desde: "EN_GESTION", hacia: "CANCELADA", roles: ["GESTOR", "ADMIN"], accion: "Cancelar" },
  { desde: "RECIBIDA", hacia: "CANCELADA", roles: ["GESTOR", "ADMIN"], accion: "Cancelar" },
];

/** Estados finales: ya no admiten ninguna transición. */
export const ESTADOS_FINALES: EstadoSolicitud[] = ["ENTREGADA", "RECHAZADA", "CANCELADA"];

export function puedeTransicionar(
  desde: EstadoSolicitud,
  hacia: EstadoSolicitud,
  rol: Rol,
): boolean {
  return TRANSICIONES.some(
    (t) => t.desde === desde && t.hacia === hacia && t.roles.includes(rol),
  );
}

/** Transiciones disponibles para un rol desde el estado actual. */
export function accionesDisponibles(
  estado: EstadoSolicitud,
  rol: Rol,
): Transicion[] {
  return TRANSICIONES.filter((t) => t.desde === estado && t.roles.includes(rol));
}

export const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  EN_GESTION: "En gestión con el almacén",
  RECIBIDA: "Recibida en bodega",
  ENTREGADA: "Entregada",
  CANCELADA: "Cancelada",
};

/**
 * Color por estado, reducido a cinco matices en vez de siete.
 *
 * Los tres estados intermedios (aprobada, en gestión, recibida) comparten el
 * color de marca: el avance por el flujo se lee como "progresando" y solo los
 * desenlaces tienen color propio. Antes cada uno usaba un matiz distinto
 * (sky/violet/indigo) que no aportaba significado distinguible.
 */
export const COLOR_ESTADO: Record<EstadoSolicitud, string> = {
  BORRADOR: "bg-lienzo text-tinta-suave ring-borde-fuerte",
  PENDIENTE: "bg-espera-fondo text-espera ring-espera-borde",
  APROBADA: "bg-marca-50 text-marca-700 ring-marca-200",
  EN_GESTION: "bg-marca-50 text-marca-700 ring-marca-200",
  RECIBIDA: "bg-marca-50 text-marca-700 ring-marca-200",
  ENTREGADA: "bg-exito-fondo text-exito ring-exito-borde",
  RECHAZADA: "bg-fallo-fondo text-fallo ring-fallo-borde",
  CANCELADA: "bg-lienzo text-tinta-tenue ring-borde",
};

export const ETIQUETA_MOTIVO: Record<Motivo, string> = {
  DESGASTE: "Desgaste por uso",
  EXTRAVIO: "Extraviado (a)",
  HURTO_MOVIL: "Hurto desde el móvil",
  PERDIDA_SINIESTRO: "Pérdida por siniestro",
  ROBO_MOVIL: "Robo de móvil",
  VENCIMIENTO_CERT: "Vencida certificación",
  NUEVA_INCORPORACION: "Nueva incorporación",
  PRIMERA_VEZ: "Solicitado por primera vez",
  STOCK_FRONTEL: "Stock Frontel",
};

/**
 * Motivos disponibles según el tipo de solicitud. Un reemplazo justifica por
 * qué se cambia algo que ya se tenía; una solicitud nueva, por qué se pide algo
 * por primera vez. Se envía como columna «Estado» al almacén.
 */
export const MOTIVOS_REEMPLAZO: Motivo[] = [
  "DESGASTE",
  "EXTRAVIO",
  "HURTO_MOVIL",
  "PERDIDA_SINIESTRO",
  "ROBO_MOVIL",
  "VENCIMIENTO_CERT",
];

export const MOTIVOS_NUEVO: Motivo[] = [
  "NUEVA_INCORPORACION",
  "PRIMERA_VEZ",
  "STOCK_FRONTEL",
];

/** Motivos válidos para un tipo de solicitud dado. */
export function motivosDe(tipo: "NUEVO" | "REEMPLAZO"): Motivo[] {
  return tipo === "REEMPLAZO" ? MOTIVOS_REEMPLAZO : MOTIVOS_NUEVO;
}

export const ETIQUETA_TIPO_BRIGADA: Record<TipoBrigada, string> = {
  EMPRESA: "Empresa",
  CONTRATISTA: "Contratista",
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  SOLICITANTE: "Solicitante",
  APROBADOR: "Aprobador",
  GESTOR: "Gestor",
  ADMIN: "Administrador",
};

/**
 * Todos los roles asignables, en orden de menor a mayor alcance. Se deriva de
 * ETIQUETA_ROL (un Record<Rol, string>) para que añadir un rol al enum sin
 * actualizar esta lista sea imposible.
 */
export const ROLES = Object.keys(ETIQUETA_ROL) as Rol[];
