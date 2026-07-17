import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { ESPECIALIDADES_CANONICAS } from "../src/domain/catalogo";
import { limpiarDominio, testPrisma } from "./helpers/database";

describe("GET /especialidades", () => {
  beforeEach(limpiarDominio);
  afterAll(async () => testPrisma.$disconnect());

  it("devuelve las seis especialidades en orden canónico y por allow-list (PUB-1.1)", async () => {
    // Arrange
    const creadas = await Promise.all(
      [...ESPECIALIDADES_CANONICAS]
        .reverse()
        .map((especialidad) =>
          testPrisma.especialidad.create({ data: especialidad }),
        ),
    );
    const idsPorNombre = new Map(creadas.map((item) => [item.nombre, item.id]));
    const app = createApp(testPrisma);

    // Act
    const response = await request(app).get("/especialidades");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: ESPECIALIDADES_CANONICAS.map(({ nombre }) => ({
        id: idsPorNombre.get(nombre),
        nombre,
      })),
    });
    for (const item of response.body.items) {
      expect(Object.keys(item)).toEqual(["id", "nombre"]);
      expect(item).not.toHaveProperty("duracionCitaMinutos");
    }
  });

  it("mantiene el catálogo vacío sin inventar datos de respaldo (PUB-1.2)", async () => {
    // Arrange
    const app = createApp(testPrisma);

    // Act
    const response = await request(app).get("/especialidades");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });
});
