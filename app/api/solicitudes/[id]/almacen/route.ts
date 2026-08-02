import { NextResponse } from "next/server";

/**
 * Ruta antigua del formato de almacén, para una sola solicitud. La generación
 * vive ahora en /api/solicitudes/almacen, que acepta varias a la vez; esto
 * queda como puente para enlaces guardados de antes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.redirect(
    new URL(`/api/solicitudes/almacen?ids=${encodeURIComponent(id)}`, request.url),
  );
}
