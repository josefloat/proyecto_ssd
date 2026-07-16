import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/prisma";

describe("GET /health", () => {
  it("responde 200 con db:ok cuando Postgres es alcanzable", async () => {
    // Arrange: contra el Postgres real de Docker Compose (DATABASE_URL del entorno)
    const app = createApp();

    // Act
    const response = await request(app).get("/health");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "ok" });
  });

  it("responde 503 sin exponer detalles de conexión cuando Postgres es inalcanzable", async () => {
    // Arrange: Prisma real contra un puerto sin servidor, no un mock.
    const unavailableDatabase = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://test:test@127.0.0.1:1/test?connect_timeout=1",
        },
      },
    });
    const app = createApp(unavailableDatabase);

    try {
      // Act
      const response = await request(app).get("/health");

      // Assert
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: "error", db: "unreachable" });
      expect(JSON.stringify(response.body)).not.toContain("127.0.0.1");
      expect(JSON.stringify(response.body)).not.toContain("5432");
    } finally {
      await unavailableDatabase.$disconnect();
    }
  });
});
