import { expect, test } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3122;
const BASE_URL = `http://localhost:${PORT}`;
const ESPECIALIDAD_ID = "22222222-2222-4222-8222-222222222222";
const MEDICOS = {
  especialidad: { id: ESPECIALIDAD_ID, nombre: "Cardiología" },
  items: [
    { id: "77777777-7777-4777-8777-777777777777", nombre: "Dra. Ana Huamán" },
    { id: "88888888-8888-4888-8888-888888888888", nombre: "Dr. Luis Quispe" },
  ],
};
let server: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});
test.afterAll(() => server.kill());

test("selecciona un médico del API sin atributos inventados (FLOW-2.1)", async ({ page }) => {
  await page.route("**/api/especialidades/*/medicos", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MEDICOS) }),
  );
  await page.goto(`${BASE_URL}/reservar/medico?especialidadId=${ESPECIALIDAD_ID}`);
  await page.getByRole("button", { name: /Dra. Ana Huamán/ }).click();
  await expect(page).toHaveURL(new RegExp(`medicoId=${MEDICOS.items[0].id}`));
  await expect(page.getByRole("button", { name: /Dra. Ana Huamán/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".doctor-card img")).toHaveCount(0);
  await expect(page.getByText(/rating|reseñas|próxima cita/i)).toHaveCount(0);
});

test("médicos vacíos no muestran profesionales de Stitch (FLOW-2.2)", async ({ page }) => {
  await page.route("**/api/especialidades/*/medicos", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ especialidad: MEDICOS.especialidad, items: [] }),
    }),
  );
  await page.goto(`${BASE_URL}/reservar/medico?especialidadId=${ESPECIALIDAD_ID}`);
  await expect(page.getByRole("heading", { name: "No hay médicos disponibles" })).toBeVisible();
  await expect(page.locator(".doctor-card")).toHaveCount(0);
  await expect(page.getByText("Ana Torres")).toHaveCount(0);
});

test("cambiar médico limpia dependencias con replace, sin duplicar historial (FLOW-1.2)", async ({ page }) => {
  await page.route("**/api/especialidades/*/medicos", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MEDICOS) }),
  );
  await page.goto(BASE_URL);
  await page.goto(
    `${BASE_URL}/reservar/medico?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICOS.items[0].id}&fechaLima=2026-07-17&slotId=slot-anterior`,
  );

  await page.getByRole("button", { name: /Dr. Luis Quispe/ }).click();

  await expect(page).toHaveURL(new RegExp(`medicoId=${MEDICOS.items[1].id}`));
  await expect(page).not.toHaveURL(/fechaLima=|slotId=/);
  await page.goBack();
  await expect(page).toHaveURL(`${BASE_URL}/`);
});

test("URL incompleta o médico retirado vuelve al primer paso válido (FLOW-1.3)", async ({ page }) => {
  await page.route("**/api/especialidades", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [MEDICOS.especialidad] }) }),
  );
  await page.route("**/api/especialidades/*/medicos", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MEDICOS) }),
  );

  await page.goto(`${BASE_URL}/reservar/medico`);
  await expect(page).toHaveURL(`${BASE_URL}/reservar/especialidad`);

  await page.goto(`${BASE_URL}/reservar/medico?especialidadId=${ESPECIALIDAD_ID}&medicoId=99999999-9999-4999-8999-999999999999`);
  await expect(page).toHaveURL(`${BASE_URL}/reservar/medico?especialidadId=${ESPECIALIDAD_ID}`);
  await expect(page.getByText("Ese médico ya no está disponible. Elige otro.")).toBeVisible();
});
