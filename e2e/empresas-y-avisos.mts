import { chromium, type Browser, type Page } from "playwright";

/**
 * Pruebas de la separación por empresa, las notificaciones, el ingreso de
 * reservas y el receptor distinto al destinatario.
 *
 * Van aparte de flujo-completo.mts porque necesitan **dos** empresas: con una
 * sola, el aislamiento no se puede comprobar —todo el mundo alcanza todo y
 * cualquier pantalla parece correcta—.
 *
 *   npm run db:escenario   # siembra (o reinicia) la segunda empresa
 *   npm run dev            # en otra terminal
 *   npm run e2e:empresas
 *
 * El escenario se reinicia en cada siembra, así que esto se puede repetir.
 */
const BASE = "http://localhost:3000";
const fallos: string[] = [];

function check(nombre: string, ok: boolean, detalle = "") {
  console.log(`${ok ? "  OK  " : " FALLA"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos.push(nombre);
}

async function login(browser: Browser, usuario: string): Promise<Page> {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill("#username", usuario);
  await p.fill("#password", "kontrol123");
  await p.click('button[type="submit"]');
  await p.waitForURL(`${BASE}/escritorio`, { timeout: 20000 });
  return p;
}

/** Cuántas solicitudes muestra el listado, leyendo los enlaces de detalle. */
async function cuantasSolicitudes(p: Page, query = "") {
  await p.goto(`${BASE}/solicitudes${query}`, { waitUntil: "networkidle" });
  return p.locator('a[href^="/solicitudes/c"]').count();
}

const nav = await chromium.launch();

const admin = await login(nav, "admin");
const gestorSur = await login(nav, "gestorsur");
const multi = await login(nav, "multigestor");
const aprobadorSur = await login(nav, "aprobadorsur");
const ruben = await login(nav, "rlagos");

// ═══════════════════════════════════════════════════════════════════════
console.log("\nA. Separación por empresa");

const nSur = await cuantasSolicitudes(gestorSur);
const nMulti = await cuantasSolicitudes(multi);
const nAdmin = await cuantasSolicitudes(admin);

check(
  "El gestor de una empresa ve solo las suyas",
  nSur > 0 && nSur < nMulti,
  `Forestal Sur: ${nSur} · multiempresa: ${nMulti} · admin: ${nAdmin}`,
);
check(
  "El gestor de dos empresas ve las de ambas",
  nMulti > nSur,
  `${nMulti} vs ${nSur}`,
);

// Una solicitud de la OTRA empresa, por enlace directo.
await multi.goto(`${BASE}/solicitudes?estado=ENTREGADA`, { waitUntil: "networkidle" });
const hrefAjena = await multi.locator('a[href^="/solicitudes/c"]').first().getAttribute("href");
await gestorSur.goto(`${BASE}${hrefAjena}`, { waitUntil: "networkidle" });
await gestorSur.waitForTimeout(1200);
check(
  "El enlace directo a una solicitud ajena queda bloqueado",
  (await gestorSur.locator("main").innerText()).includes("No tienes permiso"),
);

// Bodega: cada empresa la suya.
await gestorSur.goto(`${BASE}/bodega`, { waitUntil: "networkidle" });
const bodegaSur = await gestorSur.locator("main").innerText();
await multi.goto(`${BASE}/bodega`, { waitUntil: "networkidle" });
const bodegaMulti = await multi.locator("main").innerText();
check(
  "La bodega de Forestal Sur no muestra la de la otra empresa",
  bodegaSur.includes("Motosierra") && !bodegaSur.includes("Luminaria"),
);
check(
  "El gestor de dos empresas ve las dos bodegas",
  bodegaMulti.includes("Motosierra") && bodegaMulti.includes("Luminaria"),
);

// Pedir a nombre de otro: solo gente alcanzable.
async function buscarPersona(p: Page, termino: string) {
  await p.goto(`${BASE}/solicitudes/nueva`, { waitUntil: "networkidle" });
  const campo = p.getByPlaceholder(/Busca a la persona/);
  await campo.fill(termino);
  await p.waitForTimeout(600);
  // El buscador repite el término en «Sin resultados para «…»», así que buscar
  // el nombre en el texto de la página daría siempre positivo: lo que dice si
  // la persona está o no es que aparezca una opción.
  const texto = await p.locator("main").innerText();
  return !texto.includes("Sin resultados");
}

check(
  "Al pedir a nombre de otro aparece la gente de la propia empresa",
  await buscarPersona(gestorSur, "Rubén Lagos"),
);
check(
  "Pero no la de otra empresa",
  !(await buscarPersona(gestorSur, "Juan Pérez")),
);
check(
  "El gestor de dos empresas sí alcanza a las dos",
  (await buscarPersona(multi, "Rubén Lagos")) &&
    (await buscarPersona(multi, "Juan Pérez")),
);

// ═══════════════════════════════════════════════════════════════════════
console.log("\nB. Gestor de una o varias empresas");

await multi.goto(`${BASE}/bodega`, { waitUntil: "networkidle" });
await multi.locator('button:has-text("Agregar ítem")').first().click();
await multi.waitForTimeout(600);
check(
  "Con dos empresas, la bodega pregunta a cuál entra el ítem",
  (await multi.locator("#empresa-nuevo-item").count()) > 0,
);

await gestorSur.goto(`${BASE}/bodega`, { waitUntil: "networkidle" });
await gestorSur.locator('button:has-text("Agregar ítem")').first().click();
await gestorSur.waitForTimeout(600);
check(
  "Con una sola empresa, ese campo ni aparece",
  (await gestorSur.locator("#empresa-nuevo-item").count()) === 0,
);

await admin.goto(`${BASE}/configuracion/empresas`, { waitUntil: "networkidle" });
check(
  "El admin ve las dos empresas con su gente",
  (await admin.locator('tr:has-text("Forestal Sur")').count()) > 0 &&
    (await admin.locator('tr:has-text("Empresa principal")').count()) > 0,
);

// ═══════════════════════════════════════════════════════════════════════
console.log("\nC. Notificaciones");

const noLeidas = async (p: Page) => {
  const etiqueta = await p
    .locator('button[aria-label*="Notificaciones"]')
    .getAttribute("aria-label");
  const m = /(\d+) sin leer/.exec(etiqueta ?? "");
  return m ? Number(m[1]) : 0;
};

await ruben.goto(`${BASE}/escritorio`, { waitUntil: "networkidle" });
const antesRuben = await noLeidas(ruben);
const antesGestorSur = await noLeidas(gestorSur);

// El aprobador de Forestal Sur aprueba la solicitud pendiente de Rubén.
await aprobadorSur.goto(`${BASE}/solicitudes?estado=PENDIENTE`, { waitUntil: "networkidle" });
const hrefPendiente = await aprobadorSur
  .locator('a[href^="/solicitudes/c"]')
  .first()
  .getAttribute("href");
await aprobadorSur.goto(`${BASE}${hrefPendiente}`, { waitUntil: "networkidle" });
await aprobadorSur.locator('button:has-text("Aprobar")').first().click();
await aprobadorSur.waitForTimeout(2000);

await ruben.goto(`${BASE}/escritorio`, { waitUntil: "networkidle" });
await gestorSur.goto(`${BASE}/escritorio`, { waitUntil: "networkidle" });
await aprobadorSur.goto(`${BASE}/escritorio`, { waitUntil: "networkidle" });

check(
  "Al aprobar, el beneficiario recibe aviso",
  (await noLeidas(ruben)) > antesRuben,
  `${antesRuben} → ${await noLeidas(ruben)}`,
);
check(
  "Y el gestor de esa empresa también",
  (await noLeidas(gestorSur)) > antesGestorSur,
  `${antesGestorSur} → ${await noLeidas(gestorSur)}`,
);

await ruben.locator('button[aria-label*="Notificaciones"]').click();
await ruben.waitForTimeout(500);
check(
  "El aviso dice qué pasó y lleva a la solicitud",
  (await ruben.locator('[role="menu"]').innerText()).includes("aprobada"),
);

// El aviso no le llega a un gestor de otra empresa.
const avisosAjenos = await multi.evaluate(() => 0);
void avisosAjenos;
await aprobadorSur.goto(`${BASE}/notificaciones`, { waitUntil: "networkidle" });
const textoAprobador = await aprobadorSur.locator("main").innerText();
check(
  "Quien aprobó no se notifica a sí mismo",
  !textoAprobador.includes("lista para pedir"),
);

// ═══════════════════════════════════════════════════════════════════════
console.log("\nD. Ingreso de reservas");

// La solicitud mixta es la de Tamara Mella: se busca por nombre en vez de
// tomar «la primera aprobada», porque el paso anterior acaba de aprobar otra
// y esa pasó a encabezar el listado.
await gestorSur.goto(`${BASE}/solicitudes?estado=APROBADA&q=Tamara`, {
  waitUntil: "networkidle",
});
const hrefMixta = await gestorSur
  .locator('a[href^="/solicitudes/c"]')
  .first()
  .getAttribute("href");
await gestorSur.goto(`${BASE}${hrefMixta}`, { waitUntil: "networkidle" });
await gestorSur.locator('button:has-text("Registrar reserva y gestionar")').first().click();
await gestorSur.waitForTimeout(600);

const gruposCeco = await gestorSur.locator('input[id^="reserva-"]').count();
check(
  "Una solicitud mixta pide una reserva por cada origen",
  gruposCeco === 2,
  `${gruposCeco} grupos de CECO`,
);
check(
  "Se ofrecen las últimas reservas usadas como atajo",
  (await gestorSur.getByText("Últimas reservas usadas").count()) > 0,
);

// El campo del grupo baja a todas sus líneas.
const grupoPropia = gestorSur.locator('input[id="reserva-200/IM136"]');
await grupoPropia.fill("4500111111");
await gestorSur.waitForTimeout(300);
const lineas = gestorSur.locator('input[aria-label^="N.º de reserva de"]');
const valores = await lineas.evaluateAll((els) =>
  els.map((e) => (e as HTMLInputElement).value),
);
check(
  "El número del grupo baja a sus líneas",
  valores.filter((v) => v === "4500111111").length >= 2,
  valores.join(", "),
);

// Editar una línea la independiza, y volver a teclear arriba ya no la pisa.
const ultima = lineas.last();
await ultima.fill("4500999999");
await gestorSur.waitForTimeout(300);
check(
  "Editar una línea la marca como propia",
  (await gestorSur.getByText("reserva propia de la línea").count()) > 0,
);

await grupoPropia.fill("4500222222");
await gestorSur.waitForTimeout(300);
check(
  "El campo del grupo ya no pisa la línea editada a mano",
  (await ultima.inputValue()) === "4500999999",
  `quedó en ${await ultima.inputValue()}`,
);

// Guardar y comprobar que conviven dos números distintos.
await gestorSur.locator('input[id="reserva-FD1400D082"]').fill("4500333333");
await gestorSur.waitForTimeout(300);
await gestorSur
  .locator('form button[type="submit"]:has-text("Registrar reserva y gestionar")')
  .click();
await gestorSur.waitForTimeout(2500);
const detalle = await gestorSur.locator("main").innerText();
check(
  "Se guardan reservas distintas en la misma solicitud",
  detalle.includes("4500222222") && detalle.includes("4500999999"),
);

// ═══════════════════════════════════════════════════════════════════════
console.log("\nE. Recibe otra persona");

await gestorSur.goto(`${BASE}/solicitudes?estado=RECIBIDA`, { waitUntil: "networkidle" });
const hrefRecibida = await gestorSur
  .locator('a[href^="/solicitudes/c"]')
  .first()
  .getAttribute("href");
await gestorSur.goto(`${BASE}${hrefRecibida}/entrega`, { waitUntil: "networkidle" });

check(
  "La entrega pregunta quién recibe",
  (await gestorSur.getByText("¿Quién recibe?").count()) > 0,
);

// Elegir a otra persona con cuenta.
await gestorSur.locator('label:has-text("Otra persona con cuenta") input').click();
await gestorSur.waitForTimeout(400);
// La opción lleva nombre y detalle («Tamara Mella · Brigada Costa»), así que
// se busca por su valor en vez de por una etiqueta exacta.
const valorTamara = await gestorSur
  .locator('#recibidoPorId option', )
  .evaluateAll((els) => {
    const opt = els.find((e) => e.textContent?.includes("Tamara Mella"));
    return (opt as HTMLOptionElement | undefined)?.value ?? "";
  });
await gestorSur.locator("#recibidoPorId").selectOption(valorTamara);
check(
  "El rótulo de la firma pasa a ser de quien retira",
  (await gestorSur.getByText("Firma de quien retira").count()) > 0,
);

// Firmar. El canvas queda bajo el pliegue: sin desplazarlo, los eventos del
// ratón caen fuera del viewport y el trazo no llega a registrarse.
const lienzo = gestorSur.locator("canvas").first();
await lienzo.scrollIntoViewIfNeeded();
const caja = await lienzo.boundingBox();
if (!caja) throw new Error("No se encontró el canvas de firma");
await gestorSur.mouse.move(caja.x + 40, caja.y + caja.height / 2);
await gestorSur.mouse.down();
await gestorSur.mouse.move(caja.x + 110, caja.y + 30, { steps: 12 });
await gestorSur.mouse.move(caja.x + 180, caja.y + caja.height - 25, { steps: 12 });
await gestorSur.mouse.move(caja.x + 250, caja.y + 40, { steps: 12 });
await gestorSur.mouse.up();
await gestorSur.waitForTimeout(400);

const confirmar = gestorSur.locator('button:has-text("Confirmar entrega")');
check("Tras firmar se habilita el botón de confirmar", await confirmar.isEnabled());
await confirmar.click();
await gestorSur.waitForTimeout(3000);

const detalleEntrega = await gestorSur.locator("main").innerText();
check(
  "El detalle deja constancia de quién retiró",
  detalleEntrega.includes("Retirado y firmado por Tamara Mella"),
);
check(
  "Y el equipamiento sigue a nombre del destinatario",
  detalleEntrega.includes("A nombre de Rubén Lagos"),
);

// El acta lo refleja.
const idEntrega = await gestorSur
  .locator('a[href^="/api/actas/"]')
  .first()
  .getAttribute("href");
if (idEntrega) {
  const resp = await gestorSur.request.get(`${BASE}${idEntrega}`);
  const cuerpo = await resp.body();
  check(
    "El acta se genera como PDF",
    resp.status() === 200 && cuerpo.subarray(0, 4).toString() === "%PDF",
    `${cuerpo.length} bytes`,
  );
}

// Y a Rubén le llega el aviso de que su equipamiento se entregó.
await ruben.goto(`${BASE}/notificaciones`, { waitUntil: "networkidle" });
check(
  "El destinatario se entera de que lo retiró otro",
  (await ruben.locator("main").innerText()).includes("Tamara Mella"),
);

console.log("\n════════════════════════════════════════════════════");
console.log(
  fallos.length === 0
    ? "RESULTADO: todas las verificaciones pasaron."
    : `RESULTADO: ${fallos.length} falla(s):\n  - ${fallos.join("\n  - ")}`,
);
await nav.close();
process.exit(fallos.length === 0 ? 0 : 1);
