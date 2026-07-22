import { chromium, type Browser, type Page } from "playwright";

const BASE = "http://localhost:3000";
const fallos: string[] = [];
const errores: string[] = [];

function check(nombre: string, condicion: boolean, detalle = "") {
  console.log(`${condicion ? "  OK  " : " FALLA"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!condicion) fallos.push(nombre);
}

/** Espera a que un texto aparezca; devuelve false si no llega a tiempo. */
async function verTexto(pagina: Page, texto: string | RegExp, ms = 10000) {
  try {
    await pagina.getByText(texto).first().waitFor({ state: "visible", timeout: ms });
    return true;
  } catch {
    return false;
  }
}

/** Espera a que la página quede quieta tras una navegación o acción. */
async function asentar(pagina: Page) {
  await pagina.waitForLoadState("networkidle");
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
  // El canvas queda bajo el pliegue: sin esto los eventos caen fuera del viewport.
  await canvas.scrollIntoViewIfNeeded();
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error("No se encontró el canvas de firma");
  await pagina.mouse.move(caja.x + 40, caja.y + caja.height / 2);
  await pagina.mouse.down();
  await pagina.mouse.move(caja.x + 110, caja.y + 30, { steps: 12 });
  await pagina.mouse.move(caja.x + 180, caja.y + caja.height - 25, { steps: 12 });
  await pagina.mouse.move(caja.x + 250, caja.y + 40, { steps: 12 });
  await pagina.mouse.up();
}

const navegador = await chromium.launch();

try {
  // ---------- 1. Login y separación por rol ----------
  console.log("\n1. Login y permisos por rol");
  const solicitante = await login(navegador, "jperez");
  const aprobador = await login(navegador, "aprobador");
  const gestor = await login(navegador, "gestor");
  const admin = await login(navegador, "admin");

  check(
    "El solicitante no ve el enlace de administración",
    !(await solicitante.locator('nav a[href="/admin/usuarios"]').count()),
  );
  check(
    "El gestor tampoco ve el enlace de administración de cuentas",
    !(await gestor.locator('nav a[href="/admin/usuarios"]').count()),
  );
  check(
    "El gestor sí ve el catálogo",
    (await gestor.locator('nav a[href="/admin/articulos"]').count()) > 0,
  );
  check(
    "El admin ve el enlace de administración de cuentas",
    (await admin.locator('nav a[href="/admin/usuarios"]').count()) > 0,
  );

  await solicitante.goto(`${BASE}/admin/usuarios`);
  check(
    "El solicitante es rechazado de /admin/usuarios",
    solicitante.url().includes("/escritorio"),
    solicitante.url(),
  );

  // Administrar cuentas es exclusivo de ADMIN: el gestor llega al grupo /admin
  // (ve el catálogo) pero no a la gestión de usuarios.
  await gestor.goto(`${BASE}/admin/usuarios`);
  check(
    "El gestor es rechazado de /admin/usuarios",
    gestor.url().includes("/escritorio"),
    gestor.url(),
  );

  await solicitante.goto(`${BASE}/reportes`);
  check(
    "El solicitante es rechazado de /reportes",
    solicitante.url().includes("/escritorio"),
  );

  // ---------- 2. Solicitud de equipamiento nuevo ----------
  console.log("\n2. Flujo de equipamiento nuevo");
  await solicitante.goto(`${BASE}/solicitudes/nueva`);
  const valorBotas = await solicitante
    .locator('select option', { hasText: "Botas de seguridad" })
    .first()
    .getAttribute("value");
  await solicitante.selectOption("select", valorBotas!);
  await solicitante.click('button:has-text("Agregar")');
  await solicitante.fill('input[placeholder="Ej: 42, M, L"]', "42");
  await solicitante.fill(
    'textarea[name="justificacion"]',
    "Ingreso a brigada, requiere equipamiento base.",
  );
  await solicitante.click('button:has-text("Enviar solicitud")');
  await solicitante.waitForURL(/\/solicitudes\/c[a-z0-9]{20,}$/, { timeout: 15000 });

  const urlSolicitud = solicitante.url();
  check(
    "La solicitud queda pendiente de aprobación",
    await verTexto(solicitante, "Pendiente de aprobación"),
  );

  // El solicitante no debe poder aprobar su propia solicitud.
  check(
    "El solicitante no ve el botón Aprobar",
    !(await solicitante.locator('button:has-text("Aprobar")').count()),
  );

  // ---------- 3. Aprobación ----------
  console.log("\n3. Aprobación");
  await aprobador.goto(urlSolicitud);
  await asentar(aprobador);

  // El aprobador ajusta el pedido antes de aprobar. Al guardar, el editor debe
  // volver solo a la vista de lectura con la cantidad nueva ya aplicada.
  await aprobador.click('button:has-text("Ajustar pedido")');
  await aprobador.fill('input[id^="cant-"]', "2");
  await aprobador.click('button:has-text("Guardar cambios")');
  await aprobador.waitForTimeout(1500);
  check(
    "El editor de ítems se cierra tras guardar",
    (await aprobador.locator('button:has-text("Ajustar pedido")').count()) > 0 &&
      (await aprobador.locator('button:has-text("Guardar cambios")').count()) === 0,
  );
  const itemsTrasAjuste = await aprobador
    .locator('section:has-text("Ítems solicitados")')
    .innerText();
  check(
    "El ajuste del aprobador queda aplicado",
    /\b2 unidad/.test(itemsTrasAjuste),
    itemsTrasAjuste.replace(/\s+/g, " ").slice(0, 90),
  );

  await aprobador.click('button:has-text("Aprobar")');
  await aprobador.waitForURL(urlSolicitud, { timeout: 15000 });
  check("El aprobador aprueba la solicitud", await verTexto(aprobador, "Aprobada"));

  // ---------- 4. Gestión y recepción ----------
  console.log("\n4. Gestión con el almacén externo");
  await gestor.goto(urlSolicitud);
  await asentar(gestor);
  await gestor.fill('input[name="pedidoExternoRef"]', "OC-2026-0431");
  await gestor.click('button:has-text("Pedir al almacén")');
  await gestor.waitForURL(urlSolicitud, { timeout: 15000 });
  check(
    "Queda registrada la referencia del pedido externo",
    await verTexto(gestor, "OC-2026-0431"),
  );

  await gestor.click('button:has-text("Marcar recibida")');
  await gestor.waitForURL(urlSolicitud, { timeout: 15000 });
  check(
    "La solicitud queda recibida en bodega",
    await verTexto(gestor, "Recibida en bodega"),
  );

  // ---------- 5. Entrega con firma ----------
  console.log("\n5. Entrega con firma digital");
  await gestor.click('a:has-text("Entregar y firmar")');
  await gestor.waitForURL(/\/entrega$/, { timeout: 15000 });
  await asentar(gestor);

  const botonConfirmar = gestor.locator('button:has-text("Confirmar entrega")');
  check("Sin firma el botón de confirmar está bloqueado", await botonConfirmar.isDisabled());

  await firmar(gestor);
  check("Tras firmar el botón se habilita", await botonConfirmar.isEnabled());

  await botonConfirmar.click();
  await gestor.waitForURL(urlSolicitud, { timeout: 20000 });
  check("La solicitud queda entregada", await verTexto(gestor, "Entrega registrada"));

  // ---------- 6. Acta PDF ----------
  console.log("\n6. Acta de entrega en PDF");
  const enlaceActa = await gestor.locator('a:has-text("Descargar acta PDF")').getAttribute("href");
  const respuestaActa = await gestor.request.get(`${BASE}${enlaceActa}`);
  const pdf = await respuestaActa.body();
  check("El acta responde 200", respuestaActa.status() === 200);
  check(
    "El archivo es un PDF válido",
    pdf.subarray(0, 5).toString() === "%PDF-",
    `${pdf.length} bytes`,
  );

  // ---------- 7. Historial y cadena de reemplazo ----------
  console.log("\n7. Historial del trabajador");
  await solicitante.goto(urlSolicitud);
  const enlaceHistorial = await solicitante
    .locator('nav a:has-text("Mi equipamiento")')
    .getAttribute("href");
  await solicitante.goto(`${BASE}${enlaceHistorial}`);
  check(
    "Las botas aparecen como asignadas",
    await verTexto(solicitante, "Botas de seguridad"),
  );
  check(
    "Se muestra la fecha de vencimiento del EPP",
    (await solicitante.getByText(/vence /).count()) > 0,
  );

  // ---------- 8. Reemplazo ----------
  console.log("\n8. Flujo de reemplazo");
  await solicitante.goto(`${BASE}/solicitudes/nueva`);
  await asentar(solicitante);
  await solicitante.getByText("Reemplazo", { exact: true }).first().click();
  await solicitante.waitForTimeout(300);
  const disponiblesAntes = await solicitante.locator("select option").count();
  await solicitante.selectOption("select", { index: 1 });
  await solicitante.click('button:has-text("Agregar")');

  const selectMotivo = solicitante.locator("select").last();
  await selectMotivo.selectOption("DANO");
  await solicitante.fill("textarea", "Suela desprendida en terreno.");
  await solicitante.click('button:has-text("Enviar solicitud")');
  await solicitante.waitForURL(/\/solicitudes\/c[a-z0-9]{20,}$/, { timeout: 15000 });

  const urlReemplazo = solicitante.url();
  check("El reemplazo se crea", urlReemplazo !== urlSolicitud);
  check(
    "El motivo del reemplazo queda registrado",
    await verTexto(solicitante, "Motivo: Daño"),
  );
  check(
    "Se enlaza con la entrega anterior",
    await verTexto(solicitante, /Reemplaza el entregado el/),
  );

  // El mismo ítem no puede pedirse dos veces en paralelo: el servidor lo
  // excluye de la lista en cuanto queda referenciado por otra solicitud.
  await solicitante.goto(`${BASE}/solicitudes/nueva`);
  await asentar(solicitante);
  await solicitante.getByText("Reemplazo", { exact: true }).first().click();
  await solicitante.waitForTimeout(300);
  const despues = await solicitante.locator("select option").count();
  check(
    "El ítem ya en reemplazo no vuelve a ofrecerse",
    despues === disponiblesAntes - 1,
    `antes ${disponiblesAntes - 1}, ahora ${despues - 1}`,
  );

  // ---------- 9. Rechazo ----------
  console.log("\n9. Rechazo con motivo");
  await aprobador.goto(urlReemplazo);
  await asentar(aprobador);
  await aprobador.click('button:has-text("Rechazar")');
  await aprobador.fill('textarea[name="motivoRechazo"]', "Falta foto de la suela dañada.");
  await aprobador.click('button:has-text("Confirmar rechazo")');
  await aprobador.waitForURL(urlReemplazo, { timeout: 15000 });
  check(
    "El motivo del rechazo queda visible",
    await verTexto(aprobador, "Falta foto de la suela dañada."),
  );
  check(
    "Una solicitud rechazada ya no ofrece aprobar",
    !(await aprobador.locator('button:has-text("Aprobar")').count()),
  );

  // ---------- 10. Reportes y Excel ----------
  console.log("\n10. Reportes");
  await gestor.goto(`${BASE}/reportes`);
  await asentar(gestor);
  check(
    "La tabla de reportes se renderiza",
    await gestor.locator("table").first().isVisible(),
  );

  const respuestaExcel = await gestor.request.get(`${BASE}/api/reportes/excel`);
  const excel = await respuestaExcel.body();
  check("El Excel responde 200", respuestaExcel.status() === 200);
  check(
    "El archivo es un XLSX válido",
    excel.subarray(0, 2).toString() === "PK",
    `${excel.length} bytes`,
  );

  // Un solicitante no debe poder exportar.
  const excelProhibido = await solicitante.request.get(`${BASE}/api/reportes/excel`);
  check(
    "El solicitante no puede exportar el Excel",
    excelProhibido.status() === 403,
    `HTTP ${excelProhibido.status()}`,
  );

  // ---------- 11. Administración ----------
  console.log("\n11. Administración");
  await gestor.goto(`${BASE}/admin/articulos`);
  await gestor.fill('input[name="codigo"]', `EPP-TEST-${Date.now() % 10000}`);
  await gestor.fill('input[name="nombre"]', "Guantes anticorte");
  await gestor.fill('input[name="vidaUtilDias"]', "120");
  await gestor.click('button:has-text("Agregar artículo")');
  await gestor.waitForTimeout(1500);
  check(
    "Se agrega un artículo al catálogo",
    await verTexto(gestor, "Guantes anticorte"),
  );

  // ---------- 12. Ciclo de vida de una cuenta ----------
  console.log("\n12. Administración de cuentas");
  const cuenta = `qa${Date.now() % 100000}`;

  await admin.goto(`${BASE}/admin/usuarios`);
  await admin.fill("#nombre", "Cuenta De Prueba");
  await admin.fill("#username", cuenta);
  await admin.fill("#password", "kontrol123");
  await admin.click('button:has-text("Crear usuario")');
  await admin.waitForTimeout(1500);
  check("El admin crea una cuenta", await verTexto(admin, cuenta));

  // Editar: cambiar el rol a Aprobador y asignarle una brigada.
  await admin.locator(`tr:has-text("${cuenta}")`).getByRole("button", { name: "Editar" }).click();
  const panelEditar = admin.locator('form:has-text("Editar a Cuenta De Prueba")');
  await panelEditar.locator('select[name="rol"]').selectOption("APROBADOR");
  await panelEditar.locator('select[name="brigadaId"]').selectOption({ index: 1 });
  await panelEditar.getByRole("button", { name: "Guardar cambios" }).click();
  await admin.waitForTimeout(1500);
  check(
    "El admin edita el rol de la cuenta",
    (await admin.locator(`tr:has-text("${cuenta}")`).first().innerText()).includes("Aprobador"),
  );

  // Restablecer contraseña y comprobar que la nueva sirve para entrar.
  await admin.locator(`tr:has-text("${cuenta}")`).getByRole("button", { name: "Contraseña" }).click();
  const panelPassword = admin.locator(`form:has-text("Nueva contraseña para ${cuenta}")`);
  await panelPassword.locator('input[name="password"]').fill("kontrol456");
  await panelPassword.getByRole("button", { name: "Restablecer" }).click();
  check(
    "El admin restablece la contraseña",
    await verTexto(admin, /Contraseña de .* actualizada/),
  );

  const contextoNuevo = await navegador.newContext();
  const paginaNueva = await contextoNuevo.newPage();
  await paginaNueva.goto(`${BASE}/login`);
  await paginaNueva.fill("#username", cuenta);
  await paginaNueva.fill("#password", "kontrol456");
  await paginaNueva.click('button[type="submit"]');
  const entro = await paginaNueva
    .waitForURL("**/escritorio", { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  check("La cuenta entra con la contraseña nueva", entro, paginaNueva.url());
  await contextoNuevo.close();

  // Eliminar una cuenta con historial debe rechazarse.
  await admin.goto(`${BASE}/admin/usuarios`);
  await admin.locator('tr:has-text("jperez")').getByRole("button", { name: "Eliminar" }).click();
  await admin.locator('form:has-text("¿Eliminar la cuenta de")').getByRole("button", { name: "Sí, eliminar" }).click();
  await admin.waitForTimeout(1500);
  check(
    "No se elimina una cuenta con historial",
    await verTexto(admin, /tiene historial en el sistema/),
  );
  check(
    "La cuenta con historial sigue existiendo",
    (await admin.locator('tr:has-text("jperez")').count()) > 0,
  );

  // Eliminar la cuenta de prueba, que nunca operó, sí debe funcionar.
  await admin.goto(`${BASE}/admin/usuarios`);
  await admin.locator(`tr:has-text("${cuenta}")`).getByRole("button", { name: "Eliminar" }).click();
  await admin.locator('form:has-text("¿Eliminar la cuenta de")').getByRole("button", { name: "Sí, eliminar" }).click();
  await admin.waitForTimeout(1500);
  check(
    "Se elimina una cuenta sin historial",
    (await admin.locator(`tr:has-text("${cuenta}")`).count()) === 0,
  );

  // El admin no puede dejar el sistema sin administrador.
  const filaAdmin = admin.locator('tr:has-text("Administrador")').first();
  check(
    "El admin no puede eliminarse ni desactivarse a sí mismo",
    (await filaAdmin.getByRole("button", { name: "Eliminar" }).count()) === 0 &&
      (await filaAdmin.getByRole("button", { name: "Desactivar" }).count()) === 0,
  );
} finally {
  await navegador.close();
}

console.log("\n" + "=".repeat(52));
if (errores.length) {
  console.log(`Errores de consola (${errores.length}):`);
  for (const e of [...new Set(errores)].slice(0, 10)) console.log(`  · ${e}`);
}
if (fallos.length) {
  console.log(`RESULTADO: ${fallos.length} verificación(es) fallida(s):`);
  for (const f of fallos) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("RESULTADO: todas las verificaciones pasaron.");
