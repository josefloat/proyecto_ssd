import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  normalizarEmail,
  hashToken,
  generarTokenSesion,
  validarCredencialesLogin,
} from "../src/domain/auth";
import { PersonalApiError } from "../src/domain/personal-api";

describe("auth domain (scrypt, tokens, normalización)", () => {
  it("el hash difiere de la contraseña y verifica correctamente", () => {
    // Arrange
    const password = "Contrasena-Segura-123";

    // Act
    const hash = hashPassword(password);

    // Assert
    expect(hash).not.toContain(password);
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("otra-clave", hash)).toBe(false);
  });

  it("dos hashes de la misma contraseña usan salts distintos y no colisionan", () => {
    // Arrange
    const password = "misma-clave-para-dos";

    // Act
    const a = hashPassword(password);
    const b = hashPassword(password);

    // Assert
    expect(a).not.toBe(b);
    expect(a.split(":")[0]).not.toBe(b.split(":")[0]);
    expect(verifyPassword(password, a)).toBe(true);
    expect(verifyPassword(password, b)).toBe(true);
  });

  it("verifyPassword devuelve false ante un hash con formato inválido", () => {
    // Arrange / Act / Assert
    expect(verifyPassword("x", "no-es-un-hash")).toBe(false);
    expect(verifyPassword("x", "zz:zz")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });

  it("normaliza el email a minúsculas y sin espacios, y rechaza inválidos", () => {
    // Act / Assert
    expect(normalizarEmail("  Recepcion@SenalDeVida.PE  ")).toBe(
      "recepcion@senaldevida.pe",
    );
    expect(() => normalizarEmail("sin-arroba")).toThrow(PersonalApiError);
    expect(() => normalizarEmail("")).toThrow(PersonalApiError);
    expect(() => normalizarEmail(123)).toThrow(PersonalApiError);
  });

  it("hashToken es determinista y de 64 hex; el token generado es aleatorio", () => {
    // Arrange
    const token = generarTokenSesion();

    // Act / Assert
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(generarTokenSesion()).not.toBe(token);
  });

  it("valida el cuerpo de login y rechaza claves extra o faltantes", () => {
    // Act / Assert
    expect(
      validarCredencialesLogin({ email: "a@b.pe", password: "x" }),
    ).toEqual({ email: "a@b.pe", password: "x" });
    expect(() =>
      validarCredencialesLogin({ email: "a@b.pe" }),
    ).toThrow(PersonalApiError);
    expect(() =>
      validarCredencialesLogin({ email: "a@b.pe", password: "x", extra: 1 }),
    ).toThrow(PersonalApiError);
    expect(() => validarCredencialesLogin(null)).toThrow(PersonalApiError);
  });
});
