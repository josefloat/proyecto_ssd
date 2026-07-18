import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { EstadoCita, RolUsuario } from "@prisma/client";
import { createApp } from "../src/app";
import { limpiarDominio, testPrisma } from "./helpers/database";
import { crearCitaFixture, crearUsuario } from "./helpers/personal-fixtures";
import { verifyPassword } from "../src/domain/auth";

const AHORA = new Date("2026-07-17T14:00:00.000Z");
const reloj = () => AHORA;
const PASSWORD = "Clave-Correcta-123";

function extraerCookieSesion(res: request.Response): string {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  const objetivo = (cookies ?? []).find((c) =>
    c.startsWith("sdv_personal_session="),
  );
  return objetivo ?? "";
}

function valorCookie(cookieCompleta: string): string {
  return cookieCompleta.split(";")[0];
}

describe("sesión y autorización del personal", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("credenciales correctas crean sesión válida por rol (AUTH-1.1)", async () => {
    // Arrange
    const app = createApp(testPrisma, { reloj });
    const { medico } = await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
      prefijo: "auth11",
    });
    await crearUsuario({ rol: RolUsuario.ADMIN, password: PASSWORD, email: "admin@senaldevida.pe" });
    await crearUsuario({ rol: RolUsuario.RECEPCIONISTA, password: PASSWORD, email: "recepcion@senaldevida.pe" });
    await crearUsuario({ rol: RolUsuario.MEDICO, password: PASSWORD, email: "medico@senaldevida.pe", medicoId: medico.id });

    // Act: cada rol inicia sesión (email en distinta capitalización)
    const casos = [
      { email: "ADMIN@senaldevida.pe", rol: "ADMIN" },
      { email: "Recepcion@SenalDeVida.pe", rol: "RECEPCIONISTA" },
      { email: "medico@senaldevida.pe", rol: "MEDICO" },
    ];
    const respuestas = [];
    for (const caso of casos) {
      respuestas.push(
        await request(app)
          .post("/personal/sesion")
          .send({ email: caso.email, password: PASSWORD }),
      );
    }

    // Assert
    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(respuestas.map((r) => r.body.rol)).toEqual([
      "ADMIN",
      "RECEPCIONISTA",
      "MEDICO",
    ]);
    for (const res of respuestas) {
      const cookie = extraerCookieSesion(res);
      expect(cookie).toMatch(/^sdv_personal_session=/);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).toContain("Path=/");
      expect(cookie).not.toContain("Domain");
    }
    const sesiones = await testPrisma.sesion.findMany();
    expect(sesiones).toHaveLength(3);
    for (const sesion of sesiones) {
      expect(sesion.expiraEn.getTime() - sesion.creadaEn.getTime()).toBe(
        8 * 60 * 60 * 1_000,
      );
    }
  });

  it("email inexistente, contraseña incorrecta o usuario inactivo dan el mismo 401 sin crear sesión (AUTH-1.2)", async () => {
    // Arrange
    const app = createApp(testPrisma, { reloj });
    await crearUsuario({ rol: RolUsuario.RECEPCIONISTA, password: PASSWORD, email: "activo@senaldevida.pe" });
    await crearUsuario({ rol: RolUsuario.RECEPCIONISTA, password: PASSWORD, email: "inactivo@senaldevida.pe", activo: false });

    // Act
    const casos = [
      { email: "noexiste@senaldevida.pe", password: PASSWORD },
      { email: "activo@senaldevida.pe", password: "clave-incorrecta" },
      { email: "inactivo@senaldevida.pe", password: PASSWORD },
    ];
    const respuestas = [];
    for (const body of casos) {
      respuestas.push(await request(app).post("/personal/sesion").send(body));
    }

    // Assert
    expect(respuestas.map((r) => r.status)).toEqual([401, 401, 401]);
    const cuerpos = respuestas.map((r) => JSON.stringify(r.body));
    expect(new Set(cuerpos).size).toBe(1);
    expect(respuestas[0].body.error.code).toBe("CREDENCIALES_INVALIDAS");
    for (const res of respuestas) {
      expect(extraerCookieSesion(res)).toBe("");
    }
    expect(await testPrisma.sesion.count()).toBe(0);
  });

  it("rol no autorizado recibe 403 sin ejecutar la acción (AUTH-2.1)", async () => {
    // Arrange
    const app = createApp(testPrisma, { reloj });
    const { medico, cita } = await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
      estadoCita: EstadoCita.RESERVADA,
      prefijo: "auth21",
    });
    await crearUsuario({ rol: RolUsuario.RECEPCIONISTA, password: PASSWORD, email: "recep21@senaldevida.pe" });
    await crearUsuario({ rol: RolUsuario.MEDICO, password: PASSWORD, email: "medico21@senaldevida.pe", medicoId: medico.id });

    const loginRecep = await request(app)
      .post("/personal/sesion")
      .send({ email: "recep21@senaldevida.pe", password: PASSWORD });
    const loginMedico = await request(app)
      .post("/personal/sesion")
      .send({ email: "medico21@senaldevida.pe", password: PASSWORD });
    const cookieRecep = valorCookie(extraerCookieSesion(loginRecep));
    const cookieMedico = valorCookie(extraerCookieSesion(loginMedico));

    // Act: RECEPCIONISTA → ruta de médico; MEDICO → pago de recepción
    const recepEnMedico = await request(app)
      .get("/personal/medico/agenda")
      .set("Cookie", cookieRecep);
    const medicoEnPago = await request(app)
      .post(`/personal/recepcion/citas/${cita.id}/pago`)
      .set("Cookie", cookieMedico);

    // Assert
    expect(recepEnMedico.status).toBe(403);
    expect(medicoEnPago.status).toBe(403);
    const sinCambios = await testPrisma.cita.findUniqueOrThrow({ where: { id: cita.id } });
    expect(sinCambios.estado).toBe(EstadoCita.RESERVADA);
  });

  it("logout y expiración invalidan la sesión de inmediato (AUTH-2.2)", async () => {
    // Arrange
    await crearUsuario({ rol: RolUsuario.RECEPCIONISTA, password: PASSWORD, email: "recep22@senaldevida.pe" });
    const app = createApp(testPrisma, { reloj });
    const login = await request(app)
      .post("/personal/sesion")
      .send({ email: "recep22@senaldevida.pe", password: PASSWORD });
    const cookie = valorCookie(extraerCookieSesion(login));

    // Act 1: la sesión funciona antes del logout
    const antes = await request(app)
      .get("/personal/recepcion/agenda")
      .set("Cookie", cookie);

    // Act 2: logout y reintento con la misma cookie
    const logout = await request(app)
      .delete("/personal/sesion")
      .set("Cookie", cookie);
    const trasLogout = await request(app)
      .get("/personal/recepcion/agenda")
      .set("Cookie", cookie);

    // Assert logout
    expect(antes.status).toBe(200);
    expect(logout.status).toBe(204);
    expect(trasLogout.status).toBe(401);

    // Act 3: nueva sesión, pero consultada con el reloj 9 horas después
    const login2 = await request(app)
      .post("/personal/sesion")
      .send({ email: "recep22@senaldevida.pe", password: PASSWORD });
    const cookie2 = valorCookie(extraerCookieSesion(login2));
    const appFuturo = createApp(testPrisma, {
      reloj: () => new Date(AHORA.getTime() + 9 * 60 * 60 * 1_000),
    });
    const expirada = await request(appFuturo)
      .get("/personal/recepcion/agenda")
      .set("Cookie", cookie2);

    // Assert expiración
    expect(expirada.status).toBe(401);
  });

  it("la sesión temporal solo permite cambiar clave y exige login nuevo por rol (AUTH-3.1)", async () => {
    const app = createApp(testPrisma, { reloj });
    const { medico } = await crearCitaFixture({
      fechaLima: "2026-07-17",
      inicioUtc: new Date("2026-07-17T15:00:00.000Z"),
      prefijo: "auth31",
    });
    const usuarios = await Promise.all([
      crearUsuario({
        rol: RolUsuario.ADMIN,
        password: PASSWORD,
        email: "admin31@senaldevida.pe",
        debeCambiarPassword: true,
      }),
      crearUsuario({
        rol: RolUsuario.RECEPCIONISTA,
        password: PASSWORD,
        email: "recep31@senaldevida.pe",
        debeCambiarPassword: true,
      }),
      crearUsuario({
        rol: RolUsuario.MEDICO,
        password: PASSWORD,
        email: "medico31@senaldevida.pe",
        medicoId: medico.id,
        debeCambiarPassword: true,
      }),
    ]);
    const casos = [
      {
        usuario: usuarios[0],
        email: "admin31@senaldevida.pe",
        privada: (cookie: string) =>
          request(app)
            .post(`/personal/admin/usuarios/${usuarios[0].id}/password`)
            .set("Cookie", cookie),
      },
      {
        usuario: usuarios[1],
        email: "recep31@senaldevida.pe",
        privada: (cookie: string) =>
          request(app).get("/personal/recepcion/agenda").set("Cookie", cookie),
      },
      {
        usuario: usuarios[2],
        email: "medico31@senaldevida.pe",
        privada: (cookie: string) =>
          request(app).get("/personal/medico/agenda").set("Cookie", cookie),
      },
    ];

    for (const [indice, caso] of casos.entries()) {
      const login = await request(app)
        .post("/personal/sesion")
        .send({ email: caso.email, password: PASSWORD });
      const cookie = valorCookie(extraerCookieSesion(login));
      expect(login.body.debeCambiarPassword).toBe(true);
      const bloqueada = await caso.privada(cookie);
      expect(bloqueada.status).toBe(403);
      expect(bloqueada.body.error.code).toBe("CAMBIO_PASSWORD_REQUERIDO");

      const nueva = `Nueva-Segura-${indice + 1}-2026`;
      const cambio = await request(app)
        .post("/personal/password")
        .set("Cookie", cookie)
        .send({ passwordActual: PASSWORD, passwordNueva: nueva });
      expect(cambio.status).toBe(204);
      expect(cambio.headers["cache-control"]).toBe("no-store");
      expect(
        await testPrisma.sesion.count({
          where: { usuarioId: caso.usuario.id, revocadaEn: null },
        }),
      ).toBe(0);
      const conTemporal = await request(app)
        .post("/personal/sesion")
        .send({ email: caso.email, password: PASSWORD });
      expect(conTemporal.status).toBe(401);
      const conNueva = await request(app)
        .post("/personal/sesion")
        .send({ email: caso.email, password: nueva });
      expect(conNueva.status).toBe(200);
      expect(conNueva.body.debeCambiarPassword).toBe(false);
    }
  });

  it("reinicio revoca sesiones y los cambios inválidos no exponen ni escriben claves (AUTH-3.2)", async () => {
    const app = createApp(testPrisma, { reloj });
    await crearUsuario({
      rol: RolUsuario.ADMIN,
      password: PASSWORD,
      email: "admin32@senaldevida.pe",
    });
    const objetivo = await crearUsuario({
      rol: RolUsuario.RECEPCIONISTA,
      password: PASSWORD,
      email: "recep32@senaldevida.pe",
    });
    const loginAdmin = await request(app)
      .post("/personal/sesion")
      .send({ email: "admin32@senaldevida.pe", password: PASSWORD });
    const loginObjetivo = await request(app)
      .post("/personal/sesion")
      .send({ email: "recep32@senaldevida.pe", password: PASSWORD });
    const cookieAdmin = valorCookie(extraerCookieSesion(loginAdmin));
    const cookieAnterior = valorCookie(extraerCookieSesion(loginObjetivo));

    const reinicio = await request(app)
      .post(`/personal/admin/usuarios/${objetivo.id}/password`)
      .set("Cookie", cookieAdmin);
    expect(reinicio.status).toBe(200);
    expect(reinicio.headers["cache-control"]).toBe("no-store");
    const temporal = reinicio.body.passwordTemporal as string;
    expect(temporal).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const persistido = await testPrisma.usuario.findUniqueOrThrow({
      where: { id: objetivo.id },
    });
    expect(persistido.passwordHash).not.toContain(temporal);
    expect(verifyPassword(temporal, persistido.passwordHash)).toBe(true);
    expect(persistido.debeCambiarPassword).toBe(true);
    expect(
      await request(app)
        .get("/personal/recepcion/agenda")
        .set("Cookie", cookieAnterior),
    ).toMatchObject({ status: 401 });

    const loginTemporal = await request(app)
      .post("/personal/sesion")
      .send({ email: "recep32@senaldevida.pe", password: temporal });
    const cookieTemporal = valorCookie(extraerCookieSesion(loginTemporal));
    for (const passwordNueva of ["corta", "solominusculas123", "SINMINUSCULAS123"]) {
      const invalida = await request(app)
        .post("/personal/password")
        .set("Cookie", cookieTemporal)
        .send({ passwordActual: temporal, passwordNueva });
      expect(invalida.status).toBe(400);
      expect(JSON.stringify(invalida.body)).not.toContain(passwordNueva);
    }
    expect(
      await testPrisma.sesion.count({
        where: { usuarioId: objetivo.id, revocadaEn: null },
      }),
    ).toBe(1);
  });
});
