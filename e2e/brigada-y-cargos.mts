import { chromium, type Browser, type Page } from "playwright";

/**
 * Equipamiento a nombre de una brigada y catálogo de cargos.
 *
 * Va aparte de `flujo-completo` porque comprueba otra cosa: no el circuito de
 * una solicitud, sino que el dueño del material pueda ser una cuadrilla y que
 * eso se sostenga hasta el final —el acta, los documentos de quien firmó, la
 * ficha de la brigada— sin colarse en el «Mi equipamiento» de nadie.
 */

const BASE = "http://localhost:3000";
const fallos: string[] = [];
const errores: string[] = [];

function check(nombre: string, condicion: boolean, detalle = "") {
  console.log(`${condicion ? "  OK  " : " FALLA"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!condicion) fallos.push(nombre);
}

async function verTexto(pagina: Page, texto: string | RegExp, ms = 10000) {
  try {
    await pagina.getByText(texto).first().waitFor({ state: "visible", timeout: ms });
    return true;
  } catch {
    return false;
  }
}

async function login(browser: Browser, usuario: string): Promise<Page> {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();

  pagina.on("console", (m) => {
    if (m.type() === "error") errores.push(`[${usuario}] ${m.text()}`);
  });
  pagina.on("pageerror", (e) => errores.push(`[${usuario}] ${e.message}`));

  await pagina.goto(`${BASE}/login`);
  await pagina.fill("#username", usuario);
  await pagina.fill("#password", "kontrol123");
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL("**/escritorio", { timeout: 15000 });
  return pagina;
}

async function firmar(pagina: Page) {
  const canvas = pagina.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error("No se encontró el canvas de firma");
  await pagina.mouse.move(caja.x + 40, caja.y + caja.height / 2);
  await pagina.mouse.down();
  await pagina.mouse.move(caja.x + 110, caja.y + 30, { steps: 12 });
  await pagina.mouse.move(caja.x + 250, caja.y + 40, { steps: 12 });
  await pagina.mouse.up();
}

// Un nombre distinto en cada corrida: el cargo es único en todo el sistema y
// repetirlo haría fallar la segunda pasada por una causa que no se está
// probando.
const CARGO = `Jefe de zona ${Date.now().toString(36).slice(-4)}`;

const navegador = await chromium.launch();

try {
  // ---------- 1. Catálogo de cargos ----------
  console.log("\n1. Catálogo de cargos");
  const admin = await login(navegador, "admin");

  await admin.goto(`${BASE}/configuracion/cargos`);
  check("El ADMIN entra a Cargos", (await admin.locator("h1").innerText()) === "Cargos");

  await admin.fill("#nombre", CARGO);
  await admin.click('button[type="submit"]');
  check("Se crea un cargo", await verTexto(admin, CARGO));

  // Repetirlo tiene que rechazarse: el catálogo existe para agrupar, y dos
  // filas con el mismo nombre serían dos grupos para la misma función.
  await admin.fill("#nombre", CARGO);
  await admin.click('button[type="submit"]');
  check("No se duplica un cargo", await verTexto(admin, /ya está en la lista/));

  const gestion = await login(navegador, "gestor");
  await gestion.goto(`${BASE}/configuracion/cargos`);
  check(
    "El gestor no alcanza los cargos",
    (await gestion.locator("h1").first().innerText()).trim() === "Escritorio",
  );

  // ---------- 2. El cargo en la ficha ----------
  console.log("\n2. El cargo en la ficha de una cuenta");
  await admin.goto(`${BASE}/configuracion/usuarios?q=jperez`);
  await admin.getByRole("button", { name: "Editar" }).first().click();
  // El último: el primero es el del formulario de alta, que está más arriba.
  await admin.locator('select[name="cargoId"]').last().selectOption({ label: CARGO });
  await admin.getByRole("button", { name: "Guardar cambios" }).click();
  check("Se guarda el cargo", await verTexto(admin, /actualizado/));

  await admin.goto(`${BASE}/configuracion/usuarios?q=jperez`);
  // Dentro de la tabla: el formulario de alta lleva el mismo texto en una
  // opción de su desplegable, y buscarlo suelto lo encontraría ahí.
  check(
    "El cargo se ve junto al nombre",
    (await admin.locator("tbody").getByText(CARGO).count()) > 0,
  );

  // ---------- 3. Asignar equipamiento a una brigada ----------
  console.log("\n3. Equipamiento a nombre de la brigada");
  await gestion.goto(`${BASE}/bodega/asignar`);

  // La suite descuenta stock en cada corrida: sin esto, la primera vez que la
  // bodega se queda a cero el fallo aparece como un timeout sin explicación.
  if ((await gestion.getByText("Una brigada", { exact: true }).count()) === 0) {
    throw new Error(
      "No hay ítems con stock en la bodega de esta empresa. Reponlo (o corre npm run db:escenario) antes de repetir la suite.",
    );
  }

  await gestion.getByText("Una brigada", { exact: true }).click();
  const brigada = await gestion
    .locator('select[name="brigadaId"] option:not([disabled])')
    .first()
    .innerText();
  const nombreBrigada = brigada.split(" · ")[0];
  await gestion.locator('select[name="brigadaId"]').selectOption({ index: 1 });

  check(
    "Con una brigada desaparece «la misma persona» como quien retira",
    (await gestion.getByText("La misma persona").count()) === 0,
  );

  await gestion.getByText("Otra persona con cuenta").click();
  await gestion.locator('select[name="retiradoPorId"]').selectOption({ index: 1 });
  const retira = await gestion
    .locator('select[name="retiradoPorId"] option:checked')
    .innerText();
  const nombreRetira = retira.split(" · ")[0];

  await gestion.fill("input[placeholder^='Busca por nombre']", "");
  await gestion.locator("input[placeholder^='Busca por nombre']").fill("HER");
  await gestion.locator('ul[role="listbox"] li, [role="option"]').first().click();

  await firmar(gestion);
  await gestion.getByRole("button", { name: /^Asignar/ }).click();
  await gestion.waitForURL("**/bodega?asignacion=*", { timeout: 15000 });
  const idAsignacion = new URL(gestion.url()).searchParams.get("asignacion") ?? "";

  check("El aviso nombra a la brigada", await verTexto(gestion, nombreBrigada));
  check(
    "El aviso dice que el material es de la brigada",
    await verTexto(gestion, /queda a nombre de la brigada/),
  );

  const acta = await gestion.locator('a[href*="/acta"]').first().getAttribute("href");
  const respuesta = await gestion.request.get(`${BASE}${acta}`);
  const cuerpo = await respuesta.body();
  check(
    "El acta se descarga en PDF",
    respuesta.status() === 200 && cuerpo.subarray(0, 4).toString() === "%PDF",
    `${respuesta.status()} · ${cuerpo.length} bytes`,
  );

  // ---------- 4. Dónde aparece y dónde no ----------
  console.log("\n4. Dónde queda el equipamiento");
  // El aviso de la entrega enlaza al equipamiento de la brigada: es la
  // pregunta que sigue a «entregado», y evita ir a buscarlo a configuración.
  const hrefBrigada = await gestion
    .locator('a[href^="/historial/brigada/"]')
    .first()
    .getAttribute("href");
  check("El aviso enlaza al equipamiento de la brigada", Boolean(hrefBrigada));

  await gestion.goto(`${BASE}${hrefBrigada}`);
  check(
    "La ficha de la brigada lista su equipamiento",
    await verTexto(gestion, /Equipamiento de la brigada/),
  );
  check("Y dice quién lo retiró", await verTexto(gestion, new RegExp(`retiró ${nombreRetira}`)));

  // El material de la cuadrilla no es de ninguno de sus integrantes: si
  // apareciera en su ficha, volveríamos justo al problema que esto resuelve.
  const solicitante = await login(navegador, "jperez");
  await solicitante.goto(`${BASE}/historial/${await idDe(solicitante)}`);
  check(
    "No se cuela en el «Mi equipamiento» de un miembro",
    (await solicitante.locator(`a[href*="${idAsignacion}"]`).count()) === 0,
  );
  check(
    "Pero su brigada sí está enlazada desde su ficha",
    (await solicitante.locator('a[href^="/historial/brigada/"]').count()) > 0,
  );

  // Quien retiró firmó el acta, así que tiene que poder mostrarla aunque el
  // material no sea suyo.
  await admin.goto(`${BASE}/documentos`);
  check(
    "Quien retiró conserva el acta en sus documentos",
    (await admin.locator(`a[href*="${idAsignacion}"]`).count()) > 0,
  );

  console.log(`\n   (retiró y firmó: ${nombreRetira})`);
} finally {
  await navegador.close();
}

/** El id de quien tiene la sesión abierta, leído del enlace «Mi equipamiento». */
async function idDe(pagina: Page): Promise<string> {
  await pagina.goto(`${BASE}/escritorio`);
  const href = await pagina
    .locator('a[href^="/historial/"]:not([href^="/historial/brigada"])')
    .first()
    .getAttribute("href");
  return (href ?? "").replace("/historial/", "");
}

if (errores.length > 0) {
  console.log(`\nErrores de consola (${errores.length}):`);
  for (const e of errores.slice(0, 10)) console.log(`  · ${e}`);
}

if (fallos.length > 0) {
  console.log(`\n${fallos.length} comprobación(es) fallaron:`);
  for (const f of fallos) console.log(`  · ${f}`);
  process.exit(1);
}

console.log("\nTodo en orden.");
