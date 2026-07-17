import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { limpiarDominio, testPrisma } from "./helpers/database";

describe("GET /especialidades/:especialidadId/medicos", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("filtra y ordena médicos con un DTO público mínimo (PUB-2.1)", async () => {
    // Arrange
    const [especialidad, otraEspecialidad] = await Promise.all([
      testPrisma.especialidad.create({
        data: { nombre: "Cardiología", duracionCitaMinutos: 30 },
      }),
      testPrisma.especialidad.create({
        data: { nombre: "Pediatría", duracionCitaMinutos: 20 },
      }),
    ]);
    const [zoe, ana] = await Promise.all([
      testPrisma.medico.create({
        data: {
          nombre: "Dra. Zoe Quispe",
          horasSemanales: 8,
          especialidadId: especialidad.id,
        },
      }),
      testPrisma.medico.create({
        data: {
          nombre: "Dr. Ana Huamán",
          horasSemanales: 12,
          especialidadId: especialidad.id,
        },
      }),
      testPrisma.medico.create({
        data: {
          nombre: "Dr. Otro Médico",
          horasSemanales: 4,
          especialidadId: otraEspecialidad.id,
        },
      }),
    ]);
    const app = createApp(testPrisma);

    // Act
    const response = await request(app).get(
      `/especialidades/${especialidad.id}/medicos`,
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      especialidad: { id: especialidad.id, nombre: especialidad.nombre },
      items: [
        { id: ana.id, nombre: ana.nombre },
        { id: zoe.id, nombre: zoe.nombre },
      ],
    });
    expect(Object.keys(response.body.especialidad)).toEqual(["id", "nombre"]);
    for (const item of response.body.items) {
      expect(Object.keys(item)).toEqual(["id", "nombre"]);
      expect(item).not.toHaveProperty("horasSemanales");
      expect(item).not.toHaveProperty("fotografia");
      expect(item).not.toHaveProperty("rating");
      expect(item).not.toHaveProperty("proximaCita");
    }
  });

  it("devuelve la especialidad y lista vacía cuando no hay médicos (PUB-2.2)", async () => {
    // Arrange
    const especialidad = await testPrisma.especialidad.create({
      data: { nombre: "Dermatología", duracionCitaMinutos: 15 },
    });
    const app = createApp(testPrisma);

    // Act
    const response = await request(app).get(
      `/especialidades/${especialidad.id}/medicos`,
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      especialidad: { id: especialidad.id, nombre: especialidad.nombre },
      items: [],
    });
  });

  it("distingue UUID inválido y especialidad inexistente sin filtrar detalles (PUB-2.3)", async () => {
    // Arrange
    const app = createApp(testPrisma);

    // Act
    const invalido = await request(app).get("/especialidades/invalida/medicos");
    const inexistente = await request(app).get(
      `/especialidades/${randomUUID()}/medicos`,
    );

    // Assert
    expect(invalido.status).toBe(400);
    expect(invalido.body.error.code).toBe("QUERY_INVALIDA");
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("RECURSO_NO_ENCONTRADO");
    expect(JSON.stringify(inexistente.body)).not.toContain("Prisma");
  });
});
