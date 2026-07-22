"use server";

import { redirect } from "next/navigation";
import { obtenerSesion, verificarCredenciales } from "@/lib/auth";

export type EstadoLogin = { error?: string };

export async function iniciarSesion(
  _estado: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Ingresa tu usuario y contraseña." };
  }

  const usuario = await verificarCredenciales(username, password);
  if (!usuario) {
    // Mensaje genérico a propósito: no revelar si el usuario existe.
    return { error: "Usuario o contraseña incorrectos." };
  }

  const sesion = await obtenerSesion();
  sesion.usuarioId = usuario.id;
  await sesion.save();

  redirect("/escritorio");
}

export async function cerrarSesion() {
  const sesion = await obtenerSesion();
  sesion.destroy();
  redirect("/login");
}
