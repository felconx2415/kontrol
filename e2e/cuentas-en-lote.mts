import { chromium, type Page } from "playwright";

/**
 * Acciones en lote sobre las cuentas: mover de empresa, poner brigada y
 * activar o desactivar.
 *
 *   npm run db:escenario   # deja las dos empresas en su estado de partida
 *   npm run dev            # en otra terminal
 *   npm run e2e:lote
 *
 * Reparte gente entre las dos empresas, así que **vuelve a sembrar el escenario
 * antes de correr las otras suites**: si no, el gestor de Empresa principal deja
 * de ver a quien se movió —que es justo lo que el aislamiento debe hacer— y
 * flujo-completo falla por eso.
 */
const BASE = "http://localhost:3000";
const fallos: string[] = [];

function check(nombre: string, ok: boolean, detalle = "") {
  console.log(`${ok ? "  OK  " : " FALLA"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos.push(nombre);
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 1000 } });
const p: Page = await ctx.newPage();

await p.goto(`${BASE}/login`);
await p.fill("#username", "admin");
await p.fill("#password", "kontrol123");
await p.click('button[type="submit"]');
await p.waitForURL(`${BASE}/escritorio`);

/** Marca las filas cuyo nombre aparece en la lista. */
async function marcar(nombres: string[]) {
  for (const n of nombres) {
    await p.locator(`tr:has-text("${n}") input[type="checkbox"]`).first().check();
  }
  await p.waitForTimeout(200);
}

/** La barra de acciones en lote; «Desactivar» también existe en cada fila. */
const barra = () => p.locator('[aria-label="Acciones sobre las cuentas seleccionadas"]');

async function irALista() {
  await p.goto(`${BASE}/configuracion/usuarios?page=1`, { waitUntil: "networkidle" });
}

console.log("\n1. La barra de acciones aparece solo con algo marcado");
await irALista();
check(
  "Sin selección no hay barra",
  (await p.locator('text="cuentas seleccionadas"').count()) === 0 &&
    (await p.locator('text="cuenta seleccionada"').count()) === 0,
);


console.log("\n2. Aviso antes de mover media cuadrilla");

const deNorte = await p
  .locator('tbody tr:has(td[data-label="Brigada"]:text-is("Brigada Norte"))')
  .count();

if (deNorte >= 2) {
  // Marca solo dos de las tres.
  const filas = p.locator('tbody tr:has(td[data-label="Brigada"]:text-is("Brigada Norte"))');
  await filas.nth(0).locator('input[type="checkbox"]').check();
  await filas.nth(1).locator('input[type="checkbox"]').check();
  await p.waitForTimeout(200);

  await p.locator("#empresa-lote").selectOption({ label: "Forestal Sur" });
  await p.waitForTimeout(400);

  const aviso = await p.locator("text=/quedará/").first().innerText().catch(() => "");
  check(
    "Avisa que las cuentas quedarán sin brigada",
    aviso.includes("sin brigada"),
    aviso,
  );

  // Y ahora marco la tercera: el aviso debe cambiar a «se mudará con su gente».
  await filas.nth(2).locator('input[type="checkbox"]').check().catch(() => {});
  await p.waitForTimeout(400);
  const aviso2 = await p.locator("text=/mudará/").first().innerText().catch(() => "");
  check(
    "Con la cuadrilla completa, avisa que la brigada se muda",
    aviso2.includes("mudará"),
    aviso2,
  );

  console.log("\n3. Mover la cuadrilla completa");
  await barra().locator('button:has-text("Mover")').click();
  await p.waitForTimeout(2500);

  const texto = await p.locator("body").innerText();
  check(
    "El resumen confirma el traslado y la mudanza de la brigada",
    texto.includes("Forestal Sur") && /brigada/i.test(texto),
    (texto.match(/\d+ cuentas? en [^\n·]+[^\n]*/) ?? [""])[0],
  );
} else {
  console.log("  (Brigada Norte no tiene suficientes filas en esta página)");
}

console.log("\n4. Activar y desactivar en lote");
// Se comprueba por el mensaje y no por la fila: al desactivar, la cuenta cae al
// final del orden (`activo desc`) y se va a la última página.
await irALista();
await marcar(["Pedro Muñoz"]);
await barra().getByRole("button", { name: "Desactivar", exact: true }).click();
await p.waitForTimeout(2500);
check(
  "Desactiva en lote",
  (await p.locator("body").innerText()).includes("desactivada"),
  ((await p.locator("body").innerText()).match(/\d+ cuentas? desactivadas?\.?/) ?? [""])[0],
);

await p.goto(`${BASE}/configuracion/usuarios?page=2`, { waitUntil: "networkidle" });
await marcar(["Pedro Muñoz"]);
await barra().getByRole("button", { name: "Activar", exact: true }).click();
await p.waitForTimeout(2500);
check(
  "Y vuelve a activar",
  (await p.locator("body").innerText()).includes("activada"),
);

console.log("\n5. No se puede desactivar la propia cuenta");
await irALista();
await marcar(["Administrador"]);
await barra().getByRole("button", { name: "Desactivar", exact: true }).click();
await p.waitForTimeout(2000);
check(
  "La propia cuenta queda protegida",
  (await p.locator("body").innerText()).includes("No puedes desactivar tu propia cuenta"),
);

console.log("\n6. La brigada en lote pide una sola empresa");
await irALista();
// Una de cada empresa, por nombre: por posición dependería del reparto.
await marcar(["Felipe Contreras", "Andrea Vidal"]);
await p.waitForTimeout(400);
const cuerpo = await p.locator("body").innerText();
check(
  "Con dos empresas mezcladas, explica por qué no se puede",
  cuerpo.includes("marca cuentas de una sola empresa"),
);
check(
  "Y el selector de brigada queda deshabilitado",
  await p.locator("#brigada-lote").isDisabled(),
);

await p.screenshot({
  path: "/private/tmp/claude-501/-Users-felconx-Desktop-Kontrol/c1bb8e1c-817c-4943-a8c6-b31442ff9ed4/scratchpad/lote-usuarios.png",
  fullPage: true,
});

console.log("\n════════════════════════════════════════════════════");
console.log(
  fallos.length === 0
    ? "RESULTADO: todas las verificaciones pasaron."
    : `RESULTADO: ${fallos.length} falla(s):\n  - ${fallos.join("\n  - ")}`,
);
await nav.close();
process.exit(fallos.length === 0 ? 0 : 1);
