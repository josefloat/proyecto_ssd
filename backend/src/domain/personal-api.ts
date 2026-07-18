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
      | "CAMBIO_PASSWORD_REQUERIDO"
      | "USUARIO_NO_ENCONTRADO"
      | "EMAIL_DUPLICADO"
      | "ESPECIALIDAD_NO_ENCONTRADA"
      | "MUTACION_NO_PERMITIDA"
      | "HORAS_SEMANALES_INCOMPATIBLES"
      | "MEDICO_NO_ENCONTRADO"
      | "CONSULTORIO_NO_ENCONTRADO"
      | "VERSION_PROGRAMACION_OBSOLETA"
      | "PROGRAMACION_EN_CONFLICTO"
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

export function cambioPasswordRequerido(): PersonalApiError {
  return new PersonalApiError(
    403,
    "CAMBIO_PASSWORD_REQUERIDO",
    "Debes cambiar tu contraseña antes de continuar.",
  );
}

export function usuarioNoEncontrado(): PersonalApiError {
  return new PersonalApiError(
    404,
    "USUARIO_NO_ENCONTRADO",
    "No encontramos el usuario solicitado.",
  );
}

export function emailDuplicado(): PersonalApiError {
  return new PersonalApiError(
    409,
    "EMAIL_DUPLICADO",
    "Ya existe una cuenta con ese correo.",
  );
}

export function especialidadNoEncontrada(): PersonalApiError {
  return new PersonalApiError(
    400,
    "ESPECIALIDAD_NO_ENCONTRADA",
    "La especialidad indicada no existe.",
  );
}

export function mutacionNoPermitida(): PersonalApiError {
  return new PersonalApiError(
    409,
    "MUTACION_NO_PERMITIDA",
    "La modificación solicitada no está permitida.",
  );
}

export function horasSemanalesIncompatibles(): PersonalApiError {
  return new PersonalApiError(
    409,
    "HORAS_SEMANALES_INCOMPATIBLES",
    "Las horas semanales no cubren la programación vigente o futura.",
  );
}

export function medicoNoEncontrado(): PersonalApiError {
  return new PersonalApiError(
    404,
    "MEDICO_NO_ENCONTRADO",
    "No encontramos el médico solicitado.",
  );
}

export function consultorioNoEncontrado(): PersonalApiError {
  return new PersonalApiError(
    400,
    "CONSULTORIO_NO_ENCONTRADO",
    "Uno de los consultorios no existe.",
  );
}

export function versionProgramacionObsoleta(): PersonalApiError {
  return new PersonalApiError(
    409,
    "VERSION_PROGRAMACION_OBSOLETA",
    "La programación cambió; vuelve a cargarla antes de guardar.",
  );
}

export function programacionEnConflicto(): PersonalApiError {
  return new PersonalApiError(
    409,
    "PROGRAMACION_EN_CONFLICTO",
    "La programación excede las horas o usa un consultorio ocupado.",
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
