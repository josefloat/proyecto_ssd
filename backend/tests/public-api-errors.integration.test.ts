import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import {
  medicoNoPerteneceEspecialidad,
  recursoNoEncontrado,
} from "../src/domain/public-api";
import { prisma } from "../src/prisma";

const ESPECIALIDAD_ID = "11111111-1111-4111-8111-111111111111";
const MEDICO_ID = "22222222-2222-4222-8222-222222222222";

describe("errores públicos seguros", () => {
  it("mapea un fallo interno de catálogo a 503 sin detalles (PUB-1.3)", async () => {
    // Arrange
    const app = createApp(prisma, {
      publicApi: {
        listarEspecialidades: vi
          .fn()
          .mockRejectedValue(new Error("postgresql://usuario:secreto@interno")),
      },
    });

    // Act
    const response = await request(app).get("/especialidades");

    // Assert
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        code: "SERVICIO_NO_DISPONIBLE",
        message: "El servicio no está disponible en este momento.",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("postgresql");
    expect(Object.keys(response.body.error)).toEqual(["code", "message"]);
  });

  it("distingue UUID inválido de especialidad inexistente (PUB-2.3)", async () => {
    // Arrange
    const listarMedicos = vi.fn().mockRejectedValue(recursoNoEncontrado());
    const app = createApp(prisma, { publicApi: { listarMedicos } });

    // Act
    const invalido = await request(app).get("/especialidades/no-uuid/medicos");
    const inexistente = await request(app).get(
      `/especialidades/${ESPECIALIDAD_ID}/medicos`,
    );

    // Assert
    expect(invalido.status).toBe(400);
    expect(invalido.body.error.code).toBe("QUERY_INVALIDA");
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("RECURSO_NO_ENCONTRADO");
    expect(listarMedicos).toHaveBeenCalledTimes(1);
  });

  it.each([
    [recursoNoEncontrado(), 404, "RECURSO_NO_ENCONTRADO"],
    [
      medicoNoPerteneceEspecialidad(),
      422,
      "MEDICO_NO_PERTENECE_ESPECIALIDAD",
    ],
    [new Error("SQL y stack privados"), 503, "SERVICIO_NO_DISPONIBLE"],
  ] as const)(
    "controla fallos de disponibilidad sin datos parciales (PUB-4.2/PUB-4.3)",
    async (error, status, code) => {
      // Arrange
      const consultarDisponibilidad = vi.fn().mockRejectedValue(error);
      const app = createApp(prisma, {
        publicApi: { consultarDisponibilidad },
      });

      // Act
      const response = await request(app).get(
        `/disponibilidad?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}`,
      );

      // Assert
      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(code);
      expect(response.body).not.toHaveProperty("items");
      expect(JSON.stringify(response.body)).not.toContain("SQL");
      expect(response.headers["cache-control"]).toBe("no-store");
    },
  );
});
