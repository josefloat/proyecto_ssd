import { expect, test } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3110;
const BASE_URL = `http://localhost:${PORT}`;
let server: ReturnType<typeof startStandaloneServer>;

test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});

test.afterAll(() => server.kill());

test("la home real inicia el flujo y muestra el aviso académico (HOME-1.1)", async ({ page }) => {
  // Arrange / Act
  const response = await page.goto(BASE_URL);

  // Assert
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Reserva tu cita de manera fácil y rápida",
  );
  await expect(page.getByText("Ayacucho", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Aviso de demostración")).toContainText(
    "datos ficticios",
  );
  const ilustracion = page.getByRole("img");
  await expect(ilustracion).toHaveAttribute(
    "src",
    /profesionales-ayacucho/,
  );
  await page.getByRole("link", { name: "Sacar una cita" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/reservar/especialidad`);
});

test("solo las funciones futuras permanecen deshabilitadas (HOME-1.2)", async ({ page }) => {
  // Arrange
  await page.goto(BASE_URL);
  const urlInicial = page.url();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  // Act / Assert
  await expect(page.getByRole("link", { name: /Ver mi cita/ })).toHaveAttribute(
    "href",
    "/mi-cita",
  );
  for (const nombre of [/Mis citas/, /Notificaciones/, /Perfil/]) {
    await expect(page.getByRole("button", { name: nombre }).first()).toBeDisabled();
  }
  await expect(page.getByText("Próximamente").first()).toBeVisible();
  expect(page.url()).toBe(urlInicial);
  expect(requests.filter((url) => url.includes("/api/"))).toEqual([]);
});
