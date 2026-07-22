import type { EstadoSolicitud } from "@/generated/prisma/enums";
import { COLOR_ESTADO, ETIQUETA_ESTADO } from "@/lib/solicitud-estado";
import Insignia from "@/components/ui/insignia";

export default function EstadoBadge({ estado }: { estado: EstadoSolicitud }) {
  return <Insignia clases={COLOR_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Insignia>;
}
