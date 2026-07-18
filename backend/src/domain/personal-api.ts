// Errores de las rutas internas del personal. Se mantienen separados del
// PublicApiError del paciente para no mezclar el catálogo de códigos de una
// superficie sin contraseña con el de una superficie autenticada.
export class PersonalApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 503,
    readonly code:
      | "QUERY_INVALIDA"
      | "CREDENCIALES_INVALIDAS"
      | "NO_AUTENTICADO"
      | "NO_AUTORIZADO"
      | "CITA_NO_ENCONTRADA"
      | "CITA_NO_PAGABLE"
      | "SERVICIO_NO_DISPONIBLE",
    readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = new.target.name;
  }
}

export function queryInvalidaPersonal(): PersonalApiError {
  return new PersonalApiError(400, "QUERY_INVALIDA", "Revisa los datos enviados.");
}

// Error genérico de login: el mismo para email inexistente, contraseña
// incorrecta o usuario inactivo, para no revelar cuál de los tres ocurrió.
export function credencialesInvalidas(): PersonalApiError {
  return new PersonalApiError(
    401,
    "CREDENCIALES_INVALIDAS",
    "Correo o contraseña incorrectos.",
  );
}

export function noAutenticado(): PersonalApiError {
  return new PersonalApiError(401, "NO_AUTENTICADO", "Inicia sesión para continuar.");
}

export function noAutorizado(): PersonalApiError {
  return new PersonalApiError(
    403,
    "NO_AUTORIZADO",
    "No tienes permiso para esta acción.",
  );
}

export function citaNoEncontradaPersonal(): PersonalApiError {
  return new PersonalApiError(
    404,
    "CITA_NO_ENCONTRADA",
    "No encontramos la cita solicitada.",
  );
}

export function citaNoPagable(): PersonalApiError {
  return new PersonalApiError(
    409,
    "CITA_NO_PAGABLE",
    "La cita no puede registrarse como pagada.",
  );
}

export function servicioNoDisponiblePersonal(): PersonalApiError {
  return new PersonalApiError(
    503,
    "SERVICIO_NO_DISPONIBLE",
    "El servicio no está disponible en este momento.",
  );
}
