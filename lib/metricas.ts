import "server-only";

import { db } from "@/lib/db";
import type { EstadoSolicitud, Rol } from "@/generated/prisma/enums";
import { DIAS_AVISO_VENCIMIENTO, diasRestantes } from "@/lib/vencimientos";
import { esGestion } from "@/lib/solicitud-estado";

/** Estados que representan trabajo en curso, en orden del flujo. */
export const ETAPAS_ACTIVAS: EstadoSolicitud[] = [
  "PENDIENTE",
  "APROBADA",
  "EN_GESTION",
  "RECIBIDA",
];

export type Kpi = {
  clave: string;
  etiqueta: string;
  valor: number;
  /** Línea de contexto bajo el número; sin ella un KPI no dice nada. */
  contexto: string;
  href: string;
  alerta?: boolean;
};

export type BarraEtapa = {
  estado: EstadoSolicitud;
  etiqueta: string;
  valor: number;
  /** Antigüedad de la solicitud más vieja detenida en esta etapa, en días. */
  esperaMaxima: number | null;
};

export type BarraMes = {
  clave: string;
  etiqueta: string;
  valor: number;
  vencido: boolean;
};

export type CambioProximo = {
  id: string;
  articulo: string;
  personaId: string;
  persona: string;
  brigada: string | null;
  venceEn: Date;
  dias: number;
  /** Si ya hay una solicitud de reemplazo en curso para este ítem. */
  reemplazoEnCurso: boolean;
};

function dias(desde: Date | null): number | null {
  if (!desde) return null;
  return Math.floor((Date.now() - desde.getTime()) / 86_400_000);
}

/** Embudo de solicitudes activas por etapa, con la espera más larga de cada una. */
export async function embudoEtapas(): Promise<BarraEtapa[]> {
  const ETIQUETAS: Record<string, string> = {
    PENDIENTE: "Por aprobar",
    APROBADA: "Por pedir",
    EN_GESTION: "En camino",
    RECIBIDA: "Por entregar",
  };

  // La fecha que marca cuándo entró a la etapa cambia según la etapa.
  const CAMPO_ENTRADA: Record<string, "enviadaEn" | "aprobadaEn" | "enGestionEn" | "recibidaEn"> = {
    PENDIENTE: "enviadaEn",
    APROBADA: "aprobadaEn",
    EN_GESTION: "enGestionEn",
    RECIBIDA: "recibidaEn",
  };

  return Promise.all(
    ETAPAS_ACTIVAS.map(async (estado) => {
      const campo = CAMPO_ENTRADA[estado];
      const [total, masVieja] = await Promise.all([
        db.solicitud.count({ where: { estado } }),
        db.solicitud.findFirst({
          where: { estado },
          orderBy: { [campo]: "asc" },
          select: { [campo]: true } as Record<string, boolean>,
        }),
      ]);

      const entrada = masVieja
        ? ((masVieja as Record<string, unknown>)[campo] as Date | null)
        : null;

      return {
        estado,
        etiqueta: ETIQUETAS[estado],
        valor: total,
        esperaMaxima: dias(entrada),
      };
    }),
  );
}

/**
 * Cuántos EPP hay que cambiar por mes, mirando 6 meses hacia adelante.
 * El primer tramo agrupa lo ya vencido, que es lo que exige acción hoy.
 */
export async function vencimientosPorMes(): Promise<BarraMes[]> {
  const hoy = new Date();
  const horizonte = new Date(hoy);
  horizonte.setMonth(horizonte.getMonth() + 6);

  const items = await db.entregaItem.findMany({
    where: {
      reemplazadoEn: null,
      reemplazadoPor: null,
      venceEn: { not: null, lte: horizonte },
    },
    select: { venceEn: true },
  });

  const cubos = new Map<string, BarraMes>();
  cubos.set("vencido", {
    clave: "vencido",
    etiqueta: "Vencido",
    valor: 0,
    vencido: true,
  });

  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    cubos.set(clave, {
      clave,
      etiqueta: d.toLocaleDateString("es-CL", { month: "short" }).replace(".", ""),
      valor: 0,
      vencido: false,
    });
  }

  for (const item of items) {
    if (!item.venceEn) continue;
    if (item.venceEn < hoy) {
      cubos.get("vencido")!.valor++;
      continue;
    }
    const clave = `${item.venceEn.getFullYear()}-${String(item.venceEn.getMonth() + 1).padStart(2, "0")}`;
    const cubo = cubos.get(clave);
    if (cubo) cubo.valor++;
  }

  return [...cubos.values()];
}

/** Detalle accionable: qué hay que cambiar, de quién y cuándo. */
export async function proximosCambios(limite = 12): Promise<CambioProximo[]> {
  const corte = new Date();
  corte.setDate(corte.getDate() + DIAS_AVISO_VENCIMIENTO);

  const items = await db.entregaItem.findMany({
    where: { reemplazadoEn: null, venceEn: { not: null, lte: corte } },
    orderBy: { venceEn: "asc" },
    take: limite,
    include: {
      entrega: {
        include: {
          receptor: {
            select: { id: true, nombre: true, brigada: { select: { nombre: true } } },
          },
        },
      },
      solicitudItem: { include: { articulo: { select: { nombre: true } } } },
      reemplazadoPor: { select: { id: true } },
    },
  });

  return items.map((i) => ({
    id: i.id,
    articulo: i.solicitudItem.articulo.nombre,
    personaId: i.entrega.receptor.id,
    persona: i.entrega.receptor.nombre,
    brigada: i.entrega.receptor.brigada?.nombre ?? null,
    venceEn: i.venceEn!,
    dias: diasRestantes(i.venceEn!),
    reemplazoEnCurso: i.reemplazadoPor !== null,
  }));
}

export async function kpis(usuarioId: string, rol: Rol): Promise<Kpi[]> {
  const hoy = new Date();
  const corte30 = new Date(hoy);
  corte30.setDate(corte30.getDate() + DIAS_AVISO_VENCIMIENTO);

  const [porAprobar, antiguaPendiente, enGestion, porEntregar, vencidos, porVencer, mias] =
    await Promise.all([
      db.solicitud.count({ where: { estado: "PENDIENTE" } }),
      db.solicitud.findFirst({
        where: { estado: "PENDIENTE" },
        orderBy: { enviadaEn: "asc" },
        select: { enviadaEn: true },
      }),
      db.solicitud.count({ where: { estado: { in: ["APROBADA", "EN_GESTION"] } } }),
      db.solicitud.count({ where: { estado: "RECIBIDA" } }),
      db.entregaItem.count({
        where: { reemplazadoEn: null, venceEn: { not: null, lt: hoy } },
      }),
      db.entregaItem.count({
        where: { reemplazadoEn: null, venceEn: { not: null, gte: hoy, lte: corte30 } },
      }),
      db.solicitud.count({
        where: { solicitanteId: usuarioId, estado: { in: ETAPAS_ACTIVAS } },
      }),
    ]);

  const esperaMax = dias(antiguaPendiente?.enviadaEn ?? null);

  if (rol === "SOLICITANTE") {
    return [
      {
        clave: "mias",
        etiqueta: "Mis solicitudes en curso",
        valor: mias,
        contexto: mias === 0 ? "Nada pendiente" : "Aún no recibidas",
        href: "/solicitudes?mias=1",
      },
    ];
  }

  const lista: Kpi[] = [
    {
      clave: "aprobar",
      etiqueta: "Por aprobar",
      valor: porAprobar,
      contexto:
        porAprobar === 0
          ? "Sin cola"
          : esperaMax !== null && esperaMax > 0
            ? `La más antigua lleva ${esperaMax} d`
            : "Ingresadas hoy",
      href: "/solicitudes?estado=PENDIENTE",
      alerta: esperaMax !== null && esperaMax >= 7,
    },
  ];

  if (esGestion(rol)) {
    lista.push(
      {
        clave: "gestion",
        etiqueta: "En gestión con almacén",
        valor: enGestion,
        contexto: enGestion === 0 ? "Sin pedidos abiertos" : "Aprobadas y pedidas",
        href: "/solicitudes?estado=APROBADA",
      },
      {
        clave: "entregar",
        etiqueta: "Listas para entregar",
        valor: porEntregar,
        contexto: porEntregar === 0 ? "Nada en bodega" : "Material en bodega",
        href: "/solicitudes?estado=RECIBIDA",
        alerta: porEntregar > 0,
      },
    );
  }

  lista.push({
    clave: "vencimientos",
    etiqueta: "EPP por cambiar",
    valor: vencidos + porVencer,
    contexto:
      vencidos > 0
        ? `${vencidos} ya vencido${vencidos === 1 ? "" : "s"}`
        : `Vencen en ${DIAS_AVISO_VENCIMIENTO} días`,
    href: "#cambios",
    alerta: vencidos > 0,
  });

  return lista;
}
