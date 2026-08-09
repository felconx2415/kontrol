# Kontrol

Gestión de solicitudes y entrega de equipamiento y EPP para brigadas y personal.

Cada trabajador solicita material nuevo o el reemplazo de lo que ya tiene, un
aprobador valida, y un gestor pide el material al almacén externo y registra la
entrega con firma digital y acta en PDF.

> **Kontrol no controla inventario.** El stock vive en otro almacén; aquí se
> gestiona el ciclo de vida de la solicitud y la trazabilidad por trabajador.

## Puesta en marcha

```bash
npm install
npm run db:migrate    # crea la base SQLite y aplica migraciones
npm run db:seed       # usuarios, brigadas y catálogo de ejemplo
npm run dev
```

Abre http://localhost:3000

### Cuentas de ejemplo

Todas usan la contraseña `kontrol123`:

| Usuario     | Rol           | Qué puede hacer                                          |
| ----------- | ------------- | -------------------------------------------------------- |
| `jperez`    | Solicitante   | Crear solicitudes, ver su propio equipamiento            |
| `aprobador` | Aprobador     | Aprobar o rechazar solicitudes                           |
| `gestor`    | Gestor        | Todo lo anterior + gestión, entrega, reportes y catálogo |
| `admin`     | Administrador | Todo lo anterior + administración de cuentas             |

También existen `msoto` y `pmunoz` como solicitantes.

> `kontrol123` es solo para desarrollo. Antes de cualquier despliegue, cambia
> la contraseña de `admin` y elimina o desactiva el resto de estas cuentas.

### Empresas

La **empresa** es la frontera del sistema: quien pertenece a una ve sus
solicitudes, su bodega y su gente, y nada de las demás. Cada usuario y cada
brigada pertenece a una, y toda solicitud nace con la de su beneficiario.

Dos excepciones, que son las que hacen que el alcance no sea un simple
`empresaId`:

- El **ADMIN** administra el sistema entero y no se circunscribe a ninguna.
- El **gestor** puede atender **una o varias** a la vez: la misma persona lleva
  la logística de dos contratistas. Se marcan en su ficha
  (`/configuracion/usuarios`), y su alcance es la unión de todas.

Un gestor sin empresas marcadas cae en la suya propia, así que una cuenta nunca
queda a ciegas por olvido. Las reglas viven en `lib/alcance.ts` y toda consulta
que cruce personas pasa por ahí.

Repartir gente entre empresas se hace en lote desde `/configuracion/usuarios`:
se marcan las cuentas y se mueven de una vez. Si va la cuadrilla completa, **la
brigada se muda con ella**; si va solo parte, esas cuentas quedan sin brigada y
se avisa antes de confirmar. Cuando la empresa destino ya tiene una brigada con
ese nombre, las cuentas se enganchan a esa en vez de duplicarla.

Las empresas se administran en `/configuracion/empresas`. No se eliminan —sus
solicitudes, actas y bodega apuntan a ellas—, se desactivan: dejan de ofrecerse
al crear cuentas y brigadas sin tocar el historial.

### Roles

`ADMIN` es el rol con permiso total: hace todo lo que hace `GESTOR` y además es
el único que entra a `/configuracion/usuarios` y `/configuracion/empresas`, donde puede crear,
editar (nombre, RUT, usuario, rol, empresa y brigada), restablecer contraseñas,
activar/desactivar y eliminar cuentas.

Eliminar es permanente y solo se permite en cuentas sin historial. Si la persona
ya registró solicitudes o entregas, la acción se rechaza y hay que desactivarla:
borrarla rompería la trazabilidad de las actas de entrega firmadas.

Un administrador no puede desactivarse, eliminarse ni cambiarse el rol a sí
mismo, para que el sistema nunca quede sin quien lo administre.

## Flujo

```
BORRADOR → PENDIENTE → APROBADA → EN_GESTION → RECIBIDA → ENTREGADA
                    ↘ RECHAZADA
   (cualquier estado previo a ENTREGADA) → CANCELADA
```

| Transición   | Quién       | Qué ocurre                                     |
| ------------ | ----------- | ---------------------------------------------- |
| `PENDIENTE`  | Solicitante | Envía la solicitud                             |
| `APROBADA`   | Aprobador   | Valida la necesidad                            |
| `RECHAZADA`  | Aprobador   | Requiere motivo obligatorio                    |
| `EN_GESTION` | Gestor      | Registra la referencia del pedido al almacén   |
| `RECIBIDA`   | Gestor      | El material llegó a bodega                     |
| `ENTREGADA`  | Gestor      | Captura la firma del receptor y genera el acta |

Cada paso deja una **notificación** a quien tiene que actuar y a quien está
esperando (`lib/notificaciones.ts`), visible en la campana de la barra y en
`/notificaciones`. Nunca se notifica a quien provocó el hecho: ya lo sabe.

En la entrega, quien retira **puede no ser el destinatario**: el material va
dirigido a alguien pero lo recibe un compañero o el supervisor. Se registra
quién retiró —con cuenta o con nombre y RUT a mano— y el acta lo nombra, porque
la firma capturada es suya. El destinatario no cambia: el equipamiento sigue
siendo suyo y en su historial queda.

Las reglas viven en un solo lugar, `lib/solicitud-estado.ts`, y las usan tanto
la interfaz (para mostrar botones) como las Server Actions (para validar).
`ENTREGADA` solo puede fijarse desde `registrarEntrega()`, nunca por la vía
genérica, porque exige firma y registro de entrega.

## Estructura

```
app/(auth)/login          Ingreso
app/(app)/escritorio      Panel, distinto según rol
app/(app)/solicitudes     Listado, wizard de creación, detalle y entrega
app/(app)/bodega          Inventario propio, préstamos y asignaciones
app/(app)/historial       Qué tiene asignado cada trabajador
app/(app)/documentos      Actas firmadas de cada persona
app/(app)/notificaciones  Avisos de cada persona
app/(app)/reportes        Filtros y exportación a Excel
app/(app)/configuracion   Catálogo, usuarios, brigadas y empresas
app/api/v1                API de consulta (solo lectura, con token)
app/api                   Actas PDF, subida de imágenes, exportación Excel
actions/                  Server Actions
lib/                      Estado, alcance por empresa, navegación, auth,
                          notificaciones, PDF, vencimientos, folio, archivos
components/               Barra, menús, firma, timeline, badges, fotos
```

## Navegación

Los destinos se declaran una sola vez en `lib/navegacion.ts` —con su rol y su
grupo— y de ahí derivan las tres superficies: la barra, el menú que cuelga del
nombre y el cajón del teléfono. Mantenerlas a mano las desincronizaba sola.

La barra lleva **lo que cada rol usa a diario**, nunca más de cinco destinos.
Por eso lo personal se coloca según el rol: en terreno «Mi equipamiento» es la
razón de ser de la app y va arriba; para gestión, que casi no tiene EPP a su
nombre, vive en el menú del nombre. La configuración entra como una sola
entrada, que se adapta —un gestor alcanza solo el catálogo y va directo ahí; el
ADMIN alcanza cuatro áreas y ve el índice de `/configuracion`.

En el teléfono no se esconde nada: el cajón lista todos los destinos en
vertical, agrupados bajo «Mi trabajo», «Lo mío» y «Configuración».

## API de consulta

Para que otro sistema —un tablero, un ERP, un script— lea datos de Kontrol.
Es de **solo lectura**: todas las rutas son `GET` y cualquier otro método
responde `405`. Un token no puede crear, editar ni borrar nada.

Los tokens se emiten en `/configuracion/api` (solo ADMIN). Del token se guarda
únicamente su hash, así que el valor se muestra **una sola vez** al crearlo; si
se pierde, se revoca y se emite otro. Cada token lleva su alcance: uno de una
empresa solo ve lo de esa empresa, con las mismas reglas de `lib/alcance.ts`
que aplica la interfaz.

```bash
curl -H "Authorization: Bearer kt_…" https://epp.rmsgestion.cl/api/v1
```

Esa primera llamada devuelve el catálogo de recursos y el alcance del token, así
que sirve además para comprobar que funciona.

| Recurso | Qué devuelve | Filtros |
| --- | --- | --- |
| `GET /api/v1/solicitudes` | Solicitudes con su estado y las fechas de cada etapa | `estado`, `tipo`, `brigadaId`, `desde`, `hasta`, `q` |
| `GET /api/v1/solicitudes/{id}` | Detalle con ítems, reserva por línea y entrega | — |
| `GET /api/v1/equipamiento` | Qué tiene asignado cada persona, con serie y vencimiento | `usuarioId`, `brigadaId`, `vigente` |
| `GET /api/v1/vencimientos` | EPP vencido o por vencer | `dias` (30 por defecto) |
| `GET /api/v1/bodega` | Inventario con stock y lo prestado | `q`, `activo` |
| `GET /api/v1/bodega/prestamos` | Préstamos y sus líneas | `estado` |

Los listados aceptan `?pagina=` y `?porPagina=` (máximo 200) y responden
`{ datos, pagina, porPagina, total, totalPaginas }`. Las fechas van en ISO 8601.

> La API no modifica datos del sistema. La única escritura que hace es sellar el
> `ultimoUsoEn` del propio token —como mucho una vez por hora— para poder saber
> cuáles siguen en uso y cuáles conviene retirar.

## Trazabilidad de reemplazos

Cada `SolicitudItem` de reemplazo apunta al `EntregaItem` que sustituye
(`entregaAnteriorItemId`). Al concretarse la entrega, el ítem anterior queda
marcado con `reemplazadoEn`, de modo que el historial de un trabajador muestra
la cadena completa: qué tenía, por qué se cambió y qué recibió a cambio.

Un ítem ya referenciado por otra solicitud deja de ofrecerse, así que no pueden
pedirse dos reemplazos en paralelo del mismo elemento.

## Vencimiento de EPP

Los artículos con `vidaUtilDias` calculan su fecha de vencimiento al momento de
la entrega. El escritorio del gestor avisa de lo vencido y de lo que vence
dentro de 30 días (`lib/vencimientos.ts`).

## Verificación

```bash
npm run typecheck
npm run lint
npm run e2e            # flujo completo: requiere el servidor en localhost:3000

npm run db:escenario   # siembra (o reinicia) una segunda empresa de prueba
npm run e2e:empresas   # separación por empresa, avisos, reservas y receptor
npm run e2e:lote       # acciones en lote sobre las cuentas
npm run e2e:api        # API de consulta: token, aislamiento y solo lectura
```

`e2e:lote` reparte gente entre las dos empresas, así que hay que volver a
sembrar el escenario antes de correr las otras suites: si no, el gestor de una
empresa deja de ver a quien se movió —que es justo lo que el aislamiento debe
hacer— y `e2e` falla por eso.

`e2e:empresas` va aparte porque necesita **dos** empresas: con una sola el
aislamiento no se puede comprobar, ya que todo el mundo alcanza todo y
cualquier pantalla parece correcta. `db:escenario` crea «Forestal Sur» con su
gente, su bodega y solicitudes en distintas etapas, y reinicia esas solicitudes
en cada corrida para poder repetir la prueba.

`e2e/flujo-completo.mts` recorre con un navegador real el circuito completo:
login por rol, permisos, solicitud nueva, aprobación, gestión, entrega firmada,
descarga del acta PDF, historial, reemplazo con su cadena, rechazo con motivo,
reportes, exportación a Excel y administración.

## Notas de despliegue

- **Archivos subidos** (firmas y fotos) se guardan en `public/uploads`, lo que
  asume un servidor propio con disco persistente. En una plataforma efímera
  como Vercel hay que cambiar `lib/archivos.ts` a almacenamiento de objetos
  (S3/R2) antes de usarlo en producción.
- **SQLite** rinde bien para decenas de usuarios concurrentes en este perfil de
  uso. Para escalar a cientos, cambia el `provider` en `prisma/schema.prisma` a
  PostgreSQL y vuelve a correr las migraciones.
- **`SESSION_SECRET`** está en `.env` y debe ser distinto en producción
  (`openssl rand -base64 32`).
