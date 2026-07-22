import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/auth";
import { guardarImagen, TAMANO_MAXIMO, TIPOS_IMAGEN } from "@/lib/archivos";

export async function POST(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const formData = await request.formData();
  const archivo = formData.get("archivo");

  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }

  if (!TIPOS_IMAGEN.includes(archivo.type as (typeof TIPOS_IMAGEN)[number])) {
    return NextResponse.json(
      { error: "Formato no admitido. Usa PNG, JPG o WEBP." },
      { status: 400 },
    );
  }

  if (archivo.size > TAMANO_MAXIMO) {
    return NextResponse.json(
      { error: "La imagen supera los 8 MB." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const url = await guardarImagen(buffer, archivo.type, "evidencias");

  return NextResponse.json({ url });
}
