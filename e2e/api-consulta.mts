import { chromium, type Browser, type Page } from "playwright";

/**
 * API de consulta: autenticación, aislamiento por empresa y que sea de verdad
 * de solo lectura.
 *
 *   npm run db:escenario   # dos empresas con datos
 *   npm run dev            # en otra terminal
 *   npm run e2e:api
 *
 * Los tokens se emiten desde la interfaz —es la única vez que el valor existe—,
 * así que la prueba abre el navegador para crearlos y desde ahí llama por HTTP.
 * Al terminar los revoca.
 */
const BASE = "http://localhost:3000";
const fallos: string[] = [];

function check(nombre: string, ok: boolean, detalle = "") {
  console.log(`${ok ? "  OK  " : " FALLA"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos.push(nombre);
}

async function login(browser: Browser): Promise<Page> {
  const p = await (await browser.newContext()).newPage();
  await p.goto(`${BASE}/login`);
  await p.fill("#username", "admin");
  await p.fill("#password", "kontrol123");
  await p.click('button[type="submit"]');
  await p.waitForURL(`${BASE}/escritorio`, { timeout: 20000 });
  return p;
}

/** Emite un token desde la interfaz y devuelve su valor, visible una sola vez. */
async function emitirToken(p: Page, nombre: string, empresa: string | null) {
  await p.goto(`${BASE}/configuracion/api`, { waitUntil: "networkidle" });
  await p.fill("#nombre-token", nombre);
  await p.locator("#empresa-token").selectOption(
    empresa ? { label: empresa } : { value: "" },
  );
  await p.click('button:has-text("Crear token")');
  await p.waitForTimeout(1500);
  return (await p.locator("code.select-all").innerText()).trim();
}

const consultar = (ruta: string, token?: string) =>
  fetch(`${BASE}${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

const nav = await chromium.launch();
const admin = await login(nav);

const tokenTotal = await emitirToken(admin, "QA todas", null);
const tokenSur = await emitirToken(admin, "QA Forestal Sur", "Forestal Sur");

console.log("\n1. Autenticación");
check("Sin token responde 401", (await consultar("/api/v1")).status === 401);
check(
  "Con un token inventado responde 401",
  (await consultar("/api/v1", "kt_noexiste")).status === 401,
);
check(
  "Sin el esquema Bearer responde 401",
  (await fetch(`${BASE}/api/v1`, { headers: { Authorization: tokenTotal } })).status === 401,
);

const indice = await consultar("/api/v1", tokenTotal);
const cuerpoIndice = await indice.json();
check("Con token válido responde 200", indice.status === 200);
check(
  "El índice se describe a sí mismo",
  cuerpoIndice.soloLectura === true && typeof cuerpoIndice.recursos === "object",
  Object.keys(cuerpoIndice.recursos ?? {}).length + " recursos",
);
check(
  "Y dice el alcance del token",
  cuerpoIndice.token?.alcance === "todas las empresas",
  cuerpoIndice.token?.alcance,
);

console.log("\n2. Aislamiento por empresa");
const todas = await (await consultar("/api/v1/solicitudes?porPagina=200", tokenTotal)).json();
const soloSur = await (await consultar("/api/v1/solicitudes?porPagina=200", tokenSur)).json();

check(
  "El token de una empresa ve menos que el total",
  soloSur.total > 0 && soloSur.total < todas.total,
  `Forestal Sur ${soloSur.total} · todas ${todas.total}`,
);
check(
  "Y solo devuelve solicitudes de su empresa",
  soloSur.datos.every((s: { empresa: { nombre: string } }) => s.empresa.nombre === "Forestal Sur"),
);

// Una solicitud de la otra empresa, por id directo.
const ajena = todas.datos.find(
  (s: { empresa: { nombre: string } }) => s.empresa.nombre !== "Forestal Sur",
);
check(
  "El detalle de una solicitud ajena responde 404",
  (await consultar(`/api/v1/solicitudes/${ajena.id}`, tokenSur)).status === 404,
);
check(
  "Y la propia responde 200",
  (await consultar(`/api/v1/solicitudes/${soloSur.datos[0].id}`, tokenTotal)).status === 200,
);

console.log("\n3. Recursos");
for (const ruta of [
  "/api/v1/equipamiento",
  "/api/v1/vencimientos",
  "/api/v1/bodega",
  "/api/v1/bodega/prestamos",
]) {
  const r = await consultar(ruta, tokenTotal);
  const cuerpo = await r.json();
  check(
    `${ruta} responde con la envoltura común`,
    r.status === 200 && Array.isArray(cuerpo.datos) && typeof cuerpo.total === "number",
    `${cuerpo.total} registros`,
  );
}

const bodegaSur = await (await consultar("/api/v1/bodega", tokenSur)).json();
check(
  "La bodega también respeta la empresa",
  bodegaSur.datos.every((i: { empresa: { nombre: string } }) => i.empresa.nombre === "Forestal Sur"),
  bodegaSur.datos.map((i: { nombre: string }) => i.nombre).join(", "),
);

console.log("\n4. Paginación");
const pag = await (await consultar("/api/v1/solicitudes?porPagina=2&pagina=1", tokenTotal)).json();
check("Respeta porPagina", pag.datos.length <= 2 && pag.porPagina === 2);
const tope = await (await consultar("/api/v1/solicitudes?porPagina=9999", tokenTotal)).json();
check("Y topa porPagina en 200", tope.porPagina === 200, `${tope.porPagina}`);

console.log("\n5. De solo lectura");
for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
  const r = await fetch(`${BASE}/api/v1/solicitudes`, {
    method: metodo,
    headers: { Authorization: `Bearer ${tokenTotal}` },
  });
  check(
    `${metodo} no está permitido`,
    r.status === 405,
    `HTTP ${r.status}`,
  );
}

console.log("\n6. Revocar corta el acceso");
await admin.goto(`${BASE}/configuracion/api`, { waitUntil: "networkidle" });
await admin
  .locator('tr:has-text("QA Forestal Sur") button:has-text("Revocar")')
  .first()
  .click();
await admin.waitForTimeout(1500);
check(
  "Un token revocado responde 401",
  (await consultar("/api/v1", tokenSur)).status === 401,
);
check(
  "Y el listado lo marca como revocado",
  (await admin.locator('tr:has-text("QA Forestal Sur")').innerText()).includes("Revocado"),
);

// Limpieza: el de alcance total no debe quedar vivo tras la prueba.
await admin
  .locator('tr:has-text("QA todas") button:has-text("Revocar")')
  .first()
  .click();
await admin.waitForTimeout(1200);
check(
  "El token de la prueba queda revocado",
  (await consultar("/api/v1", tokenTotal)).status === 401,
);

console.log("\n════════════════════════════════════════════════════");
console.log(
  fallos.length === 0
    ? "RESULTADO: todas las verificaciones pasaron."
    : `RESULTADO: ${fallos.length} falla(s):\n  - ${fallos.join("\n  - ")}`,
);
await nav.close();
process.exit(fallos.length === 0 ? 0 : 1);
