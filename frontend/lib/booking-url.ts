export type BookingSelection = Readonly<{
  especialidadId?: string;
  medicoId?: string;
  fechaLima?: string;
  slotId?: string;
}>;

const PARAMETROS = [
  "especialidadId",
  "medicoId",
  "fechaLima",
  "slotId",
] as const;

export function leerSeleccion(params: URLSearchParams): BookingSelection {
  const seleccion: Record<string, string> = {};
  for (const parametro of PARAMETROS) {
    const valores = params.getAll(parametro);
    if (valores.length === 1 && valores[0]) {
      seleccion[parametro] = valores[0];
    }
  }
  return seleccion;
}

function serializar(pathname: string, seleccion: BookingSelection): string {
  const params = new URLSearchParams();
  for (const parametro of PARAMETROS) {
    const valor = seleccion[parametro];
    if (valor) params.set(parametro, valor);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function seleccionarEspecialidad(
  especialidadId: string,
  pathname = "/reservar/especialidad",
): string {
  return serializar(pathname, { especialidadId });
}

export function seleccionarMedico(
  seleccion: BookingSelection,
  medicoId: string,
  pathname = "/reservar/medico",
): string {
  return serializar(pathname, {
    especialidadId: seleccion.especialidadId,
    medicoId,
  });
}

export function seleccionarFecha(
  seleccion: BookingSelection,
  fechaLima: string,
  pathname = "/reservar/fecha-hora",
): string {
  return serializar(pathname, {
    especialidadId: seleccion.especialidadId,
    medicoId: seleccion.medicoId,
    fechaLima,
  });
}

export function seleccionarSlot(
  seleccion: BookingSelection,
  slotId: string,
  pathname = "/reservar/fecha-hora",
): string {
  return serializar(pathname, {
    especialidadId: seleccion.especialidadId,
    medicoId: seleccion.medicoId,
    fechaLima: seleccion.fechaLima,
    slotId,
  });
}

export function limpiarSeleccionInvalida(
  seleccion: BookingSelection,
  desde: "especialidad" | "medico" | "fecha" | "slot",
  pathname: string,
): string {
  if (desde === "especialidad") return serializar(pathname, {});
  if (desde === "medico") {
    return serializar(pathname, { especialidadId: seleccion.especialidadId });
  }
  if (desde === "fecha") {
    return serializar(pathname, {
      especialidadId: seleccion.especialidadId,
      medicoId: seleccion.medicoId,
    });
  }
  return serializar(pathname, {
    especialidadId: seleccion.especialidadId,
    medicoId: seleccion.medicoId,
    fechaLima: seleccion.fechaLima,
  });
}

export function rutaPrimerPasoIncompleto(
  pathname: string,
  seleccion: BookingSelection,
): string | null {
  if (pathname === "/reservar/medico" && !seleccion.especialidadId) {
    return "/reservar/especialidad";
  }
  if (pathname === "/reservar/fecha-hora" || pathname === "/reservar/datos") {
    if (!seleccion.especialidadId) return "/reservar/especialidad";
    if (!seleccion.medicoId) {
      return serializar("/reservar/medico", {
        especialidadId: seleccion.especialidadId,
      });
    }
    if (pathname === "/reservar/datos" && !seleccion.fechaLima) {
      return serializar("/reservar/fecha-hora", {
        especialidadId: seleccion.especialidadId,
        medicoId: seleccion.medicoId,
      });
    }
    if (pathname === "/reservar/datos" && !seleccion.slotId) {
      return serializar("/reservar/fecha-hora", {
        especialidadId: seleccion.especialidadId,
        medicoId: seleccion.medicoId,
        fechaLima: seleccion.fechaLima,
      });
    }
  }
  return null;
}

export function urlPasoMedico(especialidadId: string): string {
  return serializar("/reservar/medico", { especialidadId });
}

export function urlPasoFechaHora(seleccion: BookingSelection): string {
  return serializar("/reservar/fecha-hora", {
    especialidadId: seleccion.especialidadId,
    medicoId: seleccion.medicoId,
  });
}

export function urlPasoDatos(seleccion: BookingSelection): string {
  return serializar("/reservar/datos", seleccion);
}
