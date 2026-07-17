import { expect, test } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3124;
const BASE_URL = `http://localhost:${PORT}`;
const ESPECIALIDAD_ID = "22222222-2222-4222-8222-222222222222";
const MEDICO_ID = "77777777-7777-4777-8777-777777777777";
const SLOT_ID = "99999999-9999-4999-8999-999999999999";

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

const doctors = {
  especialidad: { id: ESPECIALIDAD_ID, nombre: "Cardiología" },
  items: [{ id: MEDICO_ID, nombre: "Dra. Ana Huamán" }],
};
const baseAvailability = {
  especialidad: doctors.especialidad,
  zonaHoraria: "America/Lima",
  horizonte: {
    desde: "2026-07-17",
    hastaExclusiva: "2026-08-14",
    fechas: Array.from({ length: 28 }, (_, index) => addDays("2026-07-17", index)),
  },
  items: [
    {
      id: SLOT_ID,
      fechaLima: "2026-07-17",
      inicioUtc: "2026-07-17T14:00:00.000Z",
      finUtc: "2026-07-17T14:30:00.000Z",
      medico: doctors.items[0],
      consultorio: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", codigo: "C-101", nombre: "Consultorio 101" },
    },
  ],
};
let server: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});
test.afterAll(() => server.kill());

async function routeDoctors(page: import("@playwright/test").Page) {
  await page.route("**/api/especialidades/*/medicos", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(doctors) }),
  );
}

test("seleccionar fecha y slot termina sin reservar ni escribir (FLOW-4.1)", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url());
  });
  await routeDoctors(page);
  await page.route("**/api/disponibilidad?*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(baseAvailability) }),
  );
  await page.goto(`${BASE_URL}/reservar/fecha-hora?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}`);
  await page.getByRole("button", { name: /vie.*17.*jul/i }).click();
  await page.getByRole("button", { name: /9:00.*Consultorio 101/i }).click();
  await expect(page).toHaveURL(new RegExp(`fechaLima=2026-07-17.*slotId=${SLOT_ID}`));
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
  await expect(page.getByText("Este horario todavía no está reservado")).toBeVisible();
  await expect(page.getByLabel("Horario seleccionado")).toContainText("Consultorio 101");
  expect(writes).toEqual([]);
});

test("un slot retirado se limpia al revalidar y conserva fecha/contexto (FLOW-4.2)", async ({ page }) => {
  let includeSlot = true;
  const writes: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url());
  });
  await routeDoctors(page);
  await page.route("**/api/disponibilidad?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...baseAvailability, items: includeSlot ? baseAvailability.items : [] }),
    }),
  );
  await page.goto(`${BASE_URL}/reservar/fecha-hora?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}&fechaLima=2026-07-17&slotId=${SLOT_ID}`);
  await expect(page.getByLabel("Horario seleccionado")).toBeVisible();
  includeSlot = false;
  await page.reload();
  await expect(page).not.toHaveURL(/slotId=/);
  await expect(page).toHaveURL(/fechaLima=2026-07-17/);
  const announcement = page.getByText("Ese horario ya no está disponible. Elige otro.");
  await expect(announcement).toBeVisible();
  await expect(announcement).toBeFocused();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("disponibilidad vacía conserva 28 fechas y no inventa horas (FLOW-2.2)", async ({ page }) => {
  await routeDoctors(page);
  await page.route("**/api/disponibilidad?*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...baseAvailability, items: [] }) }),
  );
  await page.goto(`${BASE_URL}/reservar/fecha-hora?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}`);
  await expect(page.getByRole("heading", { name: "No hay horarios disponibles" })).toBeVisible();
  await expect(page.locator(".date-card")).toHaveCount(28);
  await expect(page.locator(".time-slot")).toHaveCount(0);
});
