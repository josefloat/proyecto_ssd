export type FiltrosDisponibilidadPublica = Readonly<{
  especialidadId: string;
  medicoId?: string;
}>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PublicApiError extends Error {
  constructor(
    readonly status: 400 | 404 | 422 | 503,
    readonly code:
      | "QUERY_INVALIDA"
      | "RECURSO_NO_ENCONTRADO"
      | "MEDICO_NO_PERTENECE_ESPECIALIDAD"
      | "SERVICIO_NO_DISPONIBLE",
    readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = new.target.name;
  }
}

export function queryInvalida(): PublicApiError {
  return new PublicApiError(
    400,
    "QUERY_INVALIDA",
    "Revisa los datos enviados.",
  );
}

export function recursoNoEncontrado(): PublicApiError {
  return new PublicApiError(
    404,
    "RECURSO_NO_ENCONTRADO",
    "No encontramos el recurso solicitado.",
  );
}

export function medicoNoPerteneceEspecialidad(): PublicApiError {
  return new PublicApiError(
    422,
    "MEDICO_NO_PERTENECE_ESPECIALIDAD",
    "El médico no pertenece a la especialidad seleccionada.",
  );
}

export function validarUuidPublico(valor: unknown): string {
  if (typeof valor !== "string" || !UUID.test(valor)) {
    throw queryInvalida();
  }
  return valor;
}

function parametroUnico(
  query: Readonly<Record<string, unknown>>,
  nombre: string,
  opcional = false,
): string | undefined {
  const valor = query[nombre];
  if (valor === undefined && opcional) {
    return undefined;
  }
  return validarUuidPublico(valor);
}

export function validarQueryDisponibilidad(
  query: Readonly<Record<string, unknown>>,
): FiltrosDisponibilidadPublica {
  const permitidos = new Set(["especialidadId", "medicoId"]);
  if (Object.keys(query).some((clave) => !permitidos.has(clave))) {
    throw queryInvalida();
  }

  const especialidadId = parametroUnico(query, "especialidadId");
  const medicoId = parametroUnico(query, "medicoId", true);
  return medicoId ? { especialidadId: especialidadId!, medicoId } : { especialidadId: especialidadId! };
}
