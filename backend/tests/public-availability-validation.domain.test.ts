import { describe, expect, it, vi } from "vitest";
import { consultarDisponibilidadDesdeQuery } from "../src/http/public-routes";

const ESPECIALIDAD_ID = "11111111-1111-4111-8111-111111111111";
const MEDICO_ID = "22222222-2222-4222-8222-222222222222";

describe("validación previa de GET /disponibilidad", () => {
  it.each([
    {},
    { especialidadId: [ESPECIALIDAD_ID, ESPECIALIDAD_ID] },
    { especialidadId: "no-es-uuid" },
    { especialidadId: ESPECIALIDAD_ID, medicoId: [MEDICO_ID, MEDICO_ID] },
    { especialidadId: ESPECIALIDAD_ID, extra: "no-permitido" },
  ])("rechaza query ausente, repetida o malformada sin I/O (PUB-3.3)", async (query) => {
    // Arrange
    const consultar = vi.fn();

    // Act
    const resultado = consultarDisponibilidadDesdeQuery(query, consultar);

    // Assert
    await expect(resultado).rejects.toMatchObject({
      status: 400,
      code: "QUERY_INVALIDA",
    });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("entrega únicamente los UUID validados al servicio", async () => {
    // Arrange
    const respuesta = { items: [] } as never;
    const consultar = vi.fn().mockResolvedValue(respuesta);

    // Act
    const resultado = await consultarDisponibilidadDesdeQuery(
      { especialidadId: ESPECIALIDAD_ID, medicoId: MEDICO_ID },
      consultar,
    );

    // Assert
    expect(resultado).toBe(respuesta);
    expect(consultar).toHaveBeenCalledWith({
      especialidadId: ESPECIALIDAD_ID,
      medicoId: MEDICO_ID,
    });
  });
});
