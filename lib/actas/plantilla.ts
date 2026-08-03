import "server-only";

import { LOGO_PNG_BASE64 } from "@/lib/logo";
import { fuenteBase64 } from "@/lib/render-pdf";

/**
 * Plantilla común de las actas de Kontrol.
 *
 * Es el formato A4 definido por la organización: cabecera con folio en
 * negativo, las dos partes enfrentadas, el tipo de operación, la tabla de
 * ítems, la declaración, las firmas y el pie con la distribución de copias.
 * Las tres actas (entrega de solicitud, préstamo y asignación de bodega) son
 * la misma hoja con distinto contenido, así que el HTML vive una sola vez y
 * cada acta solo aporta sus datos.
 */

export type ParteActa = {
  nombre: string;
  /** Pares rótulo/valor de la columna; los vacíos se pintan «—». */
  campos: { rotulo: string; valor: string | null; dato?: boolean }[];
};

export type ItemActa = {
  articulo: string;
  codigo: string;
  serie: string | null;
  cantidad: string;
  estado: string | null;
  /** Ya formateado; null se pinta «—». */
  vence: string | null;
  /** Vencimiento próximo: se destaca en ámbar. */
  alerta?: boolean;
};

export type FirmaActa = {
  /** PNG de la firma como data URI, o null si aún no existe. */
  imagen: string | null;
  nombre: string;
  rut: string | null;
  fecha: string | null;
  rol: string;
  /**
   * Texto sobre la línea cuando no hay firma capturada. Solo tiene sentido
   * cuando falta un acto que debía ocurrir (una devolución sin registrar);
   * para quien entrega no se pone nada, porque firma a mano sobre el papel y
   * anunciarlo como «pendiente» haría parecer incompleto un acta que no lo
   * está.
   */
  pendiente?: string | null;
};

export type DatosActa = {
  /** Bajada bajo el logotipo. */
  subtitulo: string;
  /** Título del navegador y del archivo. */
  titulo: string;
  folioRotulo: string;
  folio: string;
  emitidoEn: string;
  tipoRotulo: string;
  tipoValor: string;
  recibe: ParteActa;
  entrega: ParteActa;
  itemsTitulo: string;
  items: ItemActa[];
  /** Texto libre bajo la tabla (notas del movimiento, observaciones). */
  notas?: { rotulo: string; texto: string }[];
  declaracion: string;
  firmas: FirmaActa[];
  copias: string;
  /** QR de verificación como data URI, con la URL a la que apunta. */
  qr?: { imagen: string; url: string } | null;
};

/** Escapa el contenido dinámico: los nombres y notas los escribe el usuario. */
function esc(valor: string | null | undefined): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Valor o guion largo, con la clase que atenúa los vacíos. */
function valorOVacio(valor: string | null, clases = ""): string {
  const vacio = !valor || valor.trim() === "";
  const clase = [clases, vacio ? "vacio" : ""].filter(Boolean).join(" ");
  return `<span class="${clase}">${vacio ? "—" : esc(valor)}</span>`;
}

function bloqueParte(rotulo: string, parte: ParteActa, primera: boolean): string {
  const filas = parte.campos
    .map(
      (c) =>
        `<dt>${esc(c.rotulo)}</dt><dd${c.dato ? ' class="dato"' : ""}>${
          c.valor && c.valor.trim() ? esc(c.valor) : "—"
        }</dd>`,
    )
    .join("\n        ");

  return `<div class="parte${primera ? "" : " parte-derecha"}">
      <div class="rotulo">${esc(rotulo)}</div>
      <div class="parte-nombre">${esc(parte.nombre)}</div>
      <dl class="parte-detalle">
        ${filas}
      </dl>
    </div>`;
}

function filaItem(item: ItemActa, n: number): string {
  // Un ítem con novedad tiene que saltar a la vista en el papel: es lo que se
  // reclama o se da de baja.
  const claseChip = item.alerta
    ? " alerta"
    : /nuevo/i.test(item.estado ?? "")
      ? " nuevo"
      : "";
  const estado = item.estado
    ? `<span class="chip${claseChip}">${esc(item.estado)}</span>`
    : `<span class="vacio">—</span>`;
  return `<tr>
        <td class="c-n">${n}</td>
        <td class="articulo">${esc(item.articulo)}</td>
        <td class="c-codigo dato">${valorOVacio(item.codigo)}</td>
        <td class="c-serie dato">${valorOVacio(item.serie)}</td>
        <td class="c-cant dato">${esc(item.cantidad)}</td>
        <td class="c-estado">${estado}</td>
        <td class="c-vence dato${item.alerta ? " is-alerta" : ""}">${valorOVacio(item.vence)}</td>
      </tr>`;
}

function bloqueFirma(firma: FirmaActa): string {
  const trazo = firma.imagen
    ? `<img src="${firma.imagen}" alt="">`
    : firma.pendiente
      ? `<span class="firma-pendiente">${esc(firma.pendiente)}</span>`
      : "";
  const meta = [
    firma.rut ? `RUT ${esc(firma.rut)}` : null,
    firma.fecha ? esc(firma.fecha) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<div class="firma-caja">
      <div class="firma-trazo">${trazo}</div>
      <div class="firma-linea"></div>
      <div class="firma-nombre">${esc(firma.nombre)}</div>
      ${meta ? `<div class="firma-meta">${meta}</div>` : ""}
      <div class="firma-rol">${esc(firma.rol)}</div>
    </div>`;
}

export async function construirActaHtml(datos: DatosActa): Promise<string> {
  // Fuentes incrustadas: el contenedor no debe salir a la red para imprimir.
  const [sans400, sans500, sans600, sans700, mono400, mono500, mono600] =
    await Promise.all([
      fuenteBase64("IBMPlexSans-Regular.woff2"),
      fuenteBase64("IBMPlexSans-Medium.woff2"),
      fuenteBase64("IBMPlexSans-SemiBold.woff2"),
      fuenteBase64("IBMPlexSans-Bold.woff2"),
      fuenteBase64("IBMPlexMono-Regular.woff2"),
      fuenteBase64("IBMPlexMono-Medium.woff2"),
      fuenteBase64("IBMPlexMono-SemiBold.woff2"),
    ]);

  const caraFuente = (
    familia: string,
    peso: number,
    base64: string,
  ) => `@font-face{font-family:'${familia}';font-style:normal;font-weight:${peso};font-display:block;src:url(data:font/woff2;base64,${base64}) format('woff2')}`;

  const notas = (datos.notas ?? [])
    .filter((n) => n.texto.trim())
    .map(
      (n) =>
        `<div class="nota"><span class="rotulo">${esc(n.rotulo)}</span><p>${esc(n.texto)}</p></div>`,
    )
    .join("\n  ");

  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
<meta charset="utf-8">
<title>${esc(datos.titulo)}</title>
<style>
${caraFuente("IBM Plex Sans", 400, sans400)}
${caraFuente("IBM Plex Sans", 500, sans500)}
${caraFuente("IBM Plex Sans", 600, sans600)}
${caraFuente("IBM Plex Sans", 700, sans700)}
${caraFuente("IBM Plex Mono", 400, mono400)}
${caraFuente("IBM Plex Mono", 500, mono500)}
${caraFuente("IBM Plex Mono", 600, mono600)}

:root{
  --ink:      #0F172A;
  --azul:     #2070D6;
  --celeste:  #1CAEEE;
  --ambar:    #B45309;
  --gris:     #64748B;
  --linea:    #DCE3EC;
  --wash:     #F5F8FC;

  --sans: 'IBM Plex Sans', -apple-system, 'Segoe UI', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace;
}

*{ box-sizing:border-box; margin:0; padding:0 }

@page{ size:A4; margin:0 }

html{ background:#fff }

body{
  font-family:var(--sans);
  font-size:9.5pt;
  line-height:1.45;
  color:var(--ink);
  -webkit-font-smoothing:antialiased;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}

.hoja{
  width:210mm;
  min-height:297mm;
  margin:0 auto;
  padding:15mm 16mm 12mm;
  background:#fff;
  display:flex;
  flex-direction:column;
}

.rotulo{
  font-size:6.6pt;
  font-weight:600;
  letter-spacing:.13em;
  text-transform:uppercase;
  color:var(--gris);
}

.dato{
  font-family:var(--mono);
  font-variant-numeric:tabular-nums;
  font-size:9pt;
  letter-spacing:-.01em;
}

.cabecera{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12mm;
  padding-bottom:6mm;
  border-bottom:1.6pt solid var(--ink);
}

.marca{ display:flex; align-items:center; gap:3.5mm }
.marca img{ height:11mm; width:auto; flex:none }
.marca-bajada{ margin-top:1.2mm; font-size:8.4pt; color:var(--gris) }

.folio{
  flex:none;
  min-width:44mm;
  text-align:right;
  padding:2.5mm 3.5mm;
  background:var(--ink);
  color:#fff;
}
.folio .rotulo{ color:rgba(255,255,255,.62) }
.folio-numero{
  font-family:var(--mono);
  font-variant-numeric:tabular-nums;
  font-size:19pt;
  font-weight:600;
  letter-spacing:-.02em;
  line-height:1.15;
}
.folio-fecha{ font-family:var(--mono); font-size:7.6pt; color:rgba(255,255,255,.78) }

.partes{ display:grid; grid-template-columns:1fr 1fr; gap:0; margin-top:6mm }
.parte{ padding-right:6mm }
.parte-derecha{ padding-right:0; padding-left:6mm; border-left:.5pt solid var(--linea) }
.parte-nombre{ margin:1.5mm 0 2.5mm; font-size:12.5pt; font-weight:600; letter-spacing:-.015em }
.parte-detalle{ display:grid; grid-template-columns:auto 1fr; gap:1.1mm 4mm; align-items:baseline }
.parte-detalle dt{
  font-size:6.6pt;
  font-weight:600;
  letter-spacing:.11em;
  text-transform:uppercase;
  color:var(--gris);
}
.parte-detalle dd{ font-size:8.8pt }
.parte-detalle dd.dato{ font-size:8.6pt }

.motivo{
  margin-top:6mm;
  padding:2.5mm 3.5mm;
  background:var(--wash);
  display:flex;
  align-items:baseline;
  gap:3mm;
}
.motivo strong{ font-size:9.5pt; font-weight:600 }

.seccion{
  margin-top:7mm;
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  padding-bottom:1.8mm;
  border-bottom:.9pt solid var(--azul);
}
.seccion h2{
  font-size:8.4pt;
  font-weight:700;
  letter-spacing:.13em;
  text-transform:uppercase;
  color:var(--azul);
}
.seccion .conteo{ font-family:var(--mono); font-size:8pt; color:var(--gris) }

table{ width:100%; border-collapse:collapse; table-layout:fixed }
thead{ display:table-header-group }
th{
  padding:2.6mm 2mm;
  text-align:left;
  font-size:6.6pt;
  font-weight:600;
  letter-spacing:.11em;
  text-transform:uppercase;
  color:var(--gris);
  border-bottom:.5pt solid var(--linea);
  white-space:nowrap;
}
td{ padding:2.9mm 2mm; border-bottom:.5pt solid var(--linea); vertical-align:top }
tr{ break-inside:avoid }

.c-n{ width:8mm; text-align:right; padding-right:3mm }
.c-codigo{ width:20mm }
.c-serie{ width:26mm }
.c-cant{ width:16mm; text-align:right }
.c-estado{ width:16mm }
.c-vence{ width:20mm; text-align:right }

td.c-n{ font-family:var(--mono); font-size:8pt; color:var(--gris) }
.articulo{ font-weight:500; letter-spacing:-.005em }

.chip{
  display:inline-block;
  padding:.5mm 1.8mm;
  font-size:6.8pt;
  font-weight:600;
  letter-spacing:.06em;
  text-transform:uppercase;
  border:.5pt solid var(--linea);
  color:var(--gris);
}
.chip.nuevo{ border-color:var(--celeste); color:#0B7FB0 }
.chip.alerta{ border-color:var(--ambar); color:var(--ambar); font-weight:700 }

.vacio{ color:#B6C0CE }
.is-alerta{ color:var(--ambar); font-weight:500 }

.nota{ margin-top:4mm; break-inside:avoid }
.nota p{ margin-top:1mm; font-size:8.4pt; color:#334155 }

.declaracion{
  margin-top:6mm;
  padding:3.5mm 4mm;
  background:var(--wash);
  border-left:1.6pt solid var(--celeste);
  font-size:8.2pt;
  line-height:1.55;
  color:#334155;
  break-inside:avoid;
}

.firmas{
  margin-top:8mm;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10mm;
  break-inside:avoid;
}
.firma-caja{ display:flex; flex-direction:column }
.firma-trazo{ height:20mm; display:flex; align-items:flex-end; padding-bottom:1.5mm }
.firma-trazo img{ max-height:18mm; max-width:60mm }
.firma-pendiente{
  font-size:7.4pt;
  letter-spacing:.06em;
  text-transform:uppercase;
  color:#B6C0CE;
}
.firma-linea{ border-top:.7pt solid var(--ink) }
.firma-nombre{ margin-top:1.8mm; font-size:9.5pt; font-weight:600 }
.firma-meta{ margin-top:.6mm; font-family:var(--mono); font-size:7.6pt; color:var(--gris) }
.firma-rol{
  margin-top:1.5mm;
  font-size:6.6pt;
  font-weight:600;
  letter-spacing:.11em;
  text-transform:uppercase;
  color:var(--gris);
}

.pie{
  margin-top:auto;
  padding-top:5mm;
  border-top:.5pt solid var(--linea);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8mm;
}
.pie-texto{ font-size:7pt; color:var(--gris); line-height:1.5 }
.pie-texto .dato{ font-size:7pt; color:var(--gris) }

.pie-qr{ display:flex; align-items:center; gap:2.5mm }
.pie-qr img{ width:15mm; height:15mm; border:.5pt solid var(--linea) }
.pie-qr .qr-url{
  font-family:var(--mono);
  font-size:5.6pt;
  letter-spacing:0;
  text-transform:none;
  word-break:break-all;
}
.pie-qr span{
  font-size:6.6pt;
  letter-spacing:.06em;
  text-transform:uppercase;
  color:var(--gris);
  max-width:34mm;
  line-height:1.35;
}
</style>
</head>
<body>

<article class="hoja">

  <header class="cabecera">
    <div class="marca">
      <img src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Kontrol">
      <div>
        <div class="marca-bajada">${esc(datos.subtitulo)}</div>
      </div>
    </div>

    <div class="folio">
      <div class="rotulo">${esc(datos.folioRotulo)}</div>
      <div class="folio-numero">${esc(datos.folio)}</div>
      <div class="folio-fecha">${esc(datos.emitidoEn)}</div>
    </div>
  </header>

  <section class="partes">
    ${bloqueParte("Recibe", datos.recibe, true)}
    ${bloqueParte("Entrega", datos.entrega, false)}
  </section>

  <div class="motivo">
    <span class="rotulo">${esc(datos.tipoRotulo)}</span>
    <strong>${esc(datos.tipoValor)}</strong>
  </div>

  <div class="seccion">
    <h2>${esc(datos.itemsTitulo)}</h2>
    <span class="conteo">${datos.items.length} ítem(s)</span>
  </div>

  <table>
    <thead>
      <tr>
        <th class="c-n">N°</th>
        <th>Artículo</th>
        <th class="c-codigo">Código</th>
        <th class="c-serie">N° serie / lote</th>
        <th class="c-cant">Cantidad</th>
        <th class="c-estado">Estado</th>
        <th class="c-vence">Vence</th>
      </tr>
    </thead>
    <tbody>
      ${datos.items.map((i, n) => filaItem(i, n + 1)).join("\n      ")}
    </tbody>
  </table>

  ${notas}

  <p class="declaracion">${esc(datos.declaracion)}</p>

  <section class="firmas">
    ${datos.firmas.map(bloqueFirma).join("\n    ")}
  </section>

  <footer class="pie">
    <div class="pie-texto">
      Documento generado electrónicamente por Kontrol ·
      <span class="dato">${esc(datos.emitidoEn)}</span><br>
      ${esc(datos.copias)}
    </div>
    ${
      datos.qr
        ? `<div class="pie-qr">
      <img src="${datos.qr.imagen}" alt="Verificar documento">
      <span>Verificar documento<br><span class="qr-url">${esc(
        datos.qr.url.replace(/^https?:\/\//, ""),
      )}</span></span>
    </div>`
        : ""
    }
  </footer>

</article>

</body>
</html>`;
}
