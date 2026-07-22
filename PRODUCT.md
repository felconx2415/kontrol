# Product

## Register

product

## Users

Personal de brigadas y su cadena de gestión, en cuatro roles:

- **Solicitante** — trabajador de terreno. Pide EPP nuevo o el reemplazo de lo
  que ya tiene. Uso **ocasional** (puede pasar meses entre solicitudes), a
  menudo **a la intemperie**: apurado, con guantes, bajo sol fuerte, con
  soltura digital variable.
- **Aprobador** — valida o rechaza las solicitudes de su gente.
- **Gestor** — enlace con el almacén externo. Pide el material, registra la
  entrega con firma digital y genera actas y reportes. Uso frecuente, de
  oficina.
- **Administrador** — gestiona cuentas, brigadas y catálogo.

**Trabajo a resolver:** llevar una solicitud de EPP desde que se pide hasta que
se entrega, dejando trazabilidad por trabajador. Kontrol **no controla
inventario** — el stock vive en otro almacén; aquí se gestiona el ciclo de vida
de la solicitud y la trazabilidad.

## Product Purpose

Gestionar el ciclo de vida solicitud → aprobación → gestión → entrega de EPP y
equipamiento, con rastro auditable de quién pidió, quién aprobó y quién
entregó, cerrado con firma digital y acta en PDF.

El éxito tiene dos caras que el diseño debe sostener a la vez: que un
solicitante apurado en terreno complete su pedido **rápido y sin
equivocarse**, y que el registro resultante sea **fiable y auditable** para
gestión.

## Brand Personality

**Cercano, eficiente, confiable.**

Una buena herramienta de trabajo con trato humano: directa y sin ceremonia,
pero cálida con quien la usa — pensada para gente de terreno que no es técnica.
La calidez se transmite por claridad y tono, no por decoración. Seria donde
importa (firma, actas, trazabilidad) sin volverse fría ni intimidante.

Voz: clara y directa, en español, sin jerga. Los mensajes explican qué pasó y
qué hacer, no solo que algo falló.

## Anti-references

Kontrol vive en el espacio positivo entre cuatro cosas que **no** debe parecer:

- **SaaS genérico de plantilla** — dashboard morado/azul, tarjetas idénticas en
  rejilla, gradientes, "hero metric" gigante. El look intercambiable hecho por
  IA.
- **Intranet burocrática vetusta** — tablas grises apretadas, fuentes de
  sistema, cero jerarquía, estética de portal gubernamental de 2008. Funcional
  pero deprimente.
- **App de consumo juguetona** — colores vivos, ilustraciones, animaciones
  rebotonas, emojis. Demasiado casual para una herramienta con firma y actas.
- **Empresarial frío y denso** — estilo ERP/Bloomberg: densidad máxima, gris
  azulado, intimidante. Choca de frente con "cercano y humano".

## Design Principles

1. **Velocidad sobre densidad.** Cada pantalla optimiza el camino a la acción:
   pocos pasos, objetivos grandes, imposible equivocarse. Ante la duda entre
   más información y menos fricción, gana menos fricción.
2. **Cálido sin ser casual.** Humano y cercano en el trato, serio con el
   registro. La calidez viene de la claridad, el tono y el espacio — nunca de
   adornos que compitan con la tarea.
3. **Legible primero.** Se lee bajo sol fuerte y con poca práctica digital. El
   contraste alto y el tamaño generoso ganan a la elegancia apretada. La
   densidad nunca se compra sacrificando legibilidad.
4. **El registro es sagrado.** Trazabilidad y confianza por encima de la
   comodidad: el diseño deja rastro claro e inequívoco de quién hizo qué, y las
   acciones irreversibles se confirman.
5. **Color con significado.** El color de estado (pendiente / aprobado /
   entregado) es semántico, nunca decorativo. El verde queda reservado a la
   semántica de estado; el primario azul petróleo es "acción disponible".

## Accessibility & Inclusion

Objetivo **WCAG 2.1 AA**, ya vigente en el código:

- Texto de cuerpo ≥ 4.5:1; texto grande ≥ 3:1; placeholders al mismo 4.5:1.
- Objetivos táctiles ≥ 44×44px (se usa con guantes).
- Foco visible con `focus-visible` en todo elemento interactivo.
- `prefers-reduced-motion` respetado: conserva fundidos de color y opacidad,
  anula desplazamiento y escala.

Necesidad específica confirmada: **legibilidad bajo sol fuerte** en terreno —
contraste alto y tamaño generoso son requisito, no preferencia. Corolario: el
estado nunca depende solo del color (siempre texto o ícono además), lo que
además cubre daltonismo.
