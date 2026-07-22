import type { ReactNode } from "react";

/**
 * Píldora de estado. Recibe las clases de color ya resueltas desde los mapas
 * de dominio (COLOR_ESTADO, COLOR_VENCIMIENTO) para no duplicar la semántica.
 */
export default function Insignia({
  clases,
  children,
}: {
  clases: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${clases}`}
    >
      {children}
    </span>
  );
}
