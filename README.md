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

### Roles

`ADMIN` es el rol con permiso total: hace todo lo que hace `GESTOR` y además es
el único que entra a `/admin/usuarios`, donde puede crear, editar (nombre, RUT,
usuario, rol y brigada), restablecer contraseñas, activar/desactivar y eliminar
cuentas.

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

Las reglas viven en un solo lugar, `lib/solicitud-estado.ts`, y las usan tanto
la interfaz (para mostrar botones) como las Server Actions (para validar).
`ENTREGADA` solo puede fijarse desde `registrarEntrega()`, nunca por la vía
genérica, porque exige firma y registro de entrega.

## Estructura

```
app/(auth)/login       Ingreso
app/(app)/escritorio   Panel, distinto según rol
app/(app)/solicitudes  Listado, wizard de creación, detalle y entrega
app/(app)/historial    Qué tiene asignado cada trabajador
app/(app)/reportes     Filtros y exportación a Excel
app/(app)/admin        Usuarios y catálogo (solo Gestor)
app/api                Actas PDF, subida de imágenes, exportación Excel
actions/               Server Actions
lib/                   Estado, auth, PDF, vencimientos, folio, archivos
components/            Firma, timeline, badges, subida de fotos
```

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
npm run e2e        # requiere el servidor corriendo en localhost:3000
```

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
