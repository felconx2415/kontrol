import type { ReactNode } from "react";

/**
 * Estilo compartido por input, select y textarea.
 *
 * `text-base` en móvil no es estético: por debajo de 16px iOS hace zoom
 * automático al enfocar el campo y descoloca la pantalla completa. En sm+
 * baja a 14px para recuperar densidad en escritorio.
 *
 * `min-h-11` = 44px, el mínimo táctil: esta app se usa con guantes.
 */
export const CONTROL =
  "foco-anillo min-h-11 w-full rounded-lg border border-borde-fuerte bg-panel px-3 py-2 text-base text-tinta transition-colors duration-150 placeholder:text-tinta-tenue hover:border-marca-300 disabled:cursor-not-allowed disabled:bg-panel-suave disabled:text-tinta-tenue sm:text-sm";

export function Etiqueta({
  children,
  requerido,
  htmlFor,
}: {
  children: ReactNode;
  requerido?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-tinta-suave"
    >
      {children}
      {requerido && (
        <span className="text-fallo" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );
}

/** Envoltura etiqueta + control + pista/error. `children` es el control. */
export function Campo({
  etiqueta,
  htmlFor,
  requerido,
  pista,
  error,
  children,
  className = "",
}: {
  etiqueta: string;
  htmlFor?: string;
  requerido?: boolean;
  pista?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Etiqueta htmlFor={htmlFor} requerido={requerido}>
        {etiqueta}
      </Etiqueta>
      {children}
      {pista && !error && (
        <p className="mt-1 text-xs text-tinta-tenue">{pista}</p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-fallo">
          {error}
        </p>
      )}
    </div>
  );
}

export function Entrada(props: React.ComponentProps<"input">) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function Seleccion(props: React.ComponentProps<"select">) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function AreaTexto(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}
