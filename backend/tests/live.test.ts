import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/prisma";

describe("GET /live", () => {
  it("responde 200 sin consultar la base de datos", async () => {
    // Arrange
    const app = createApp();
    const queryRawSpy = vi.spyOn(prisma, "$queryRaw");

    // Act
    const response = await request(app).get("/live");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(queryRawSpy).not.toHaveBeenCalled();
  });

  it("sigue respondiendo 200 aunque la base de datos esté inalcanzable", async () => {
    // Arrange
    const app = createApp();
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("db down"));

    // Act
    const response = await request(app).get("/live");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
