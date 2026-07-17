import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3132;
const BASE_URL = `http://localhost:${PORT}`;
const SLOT_ID = "30000000-0000-4000-8000-000000000099";
const DATA_URL = `${BASE_URL}/reservar/datos?especialidadId=10000000-0000-4000-8000-000000000002&medicoId=20000000-0000-4000-8000-000000000002&fechaLima=2026-07-20&slotId=${SLOT_ID}`;
const detalle = {
  id: "40000000-0000-4000-8000-000000000099",
  codigoReserva: "SV-JKMNPQRS",
  estado: "RESERVADA",
  motivoCancelacion: null,
  reservadaEn: "2026-07-17T15:00:00.000Z",
  venceEn: "2026-07-20T15:00:00.000Z",
  canceladaEn: null,
  paciente: { nombre: "Rosa Huamán Quispe" },
  slot: {
    id: SLOT_ID,
    fechaLima: "2026-07-20",
    inicioUtc: "2026-07-20T14:00:00.000Z",
    finUtc: "2026-07-20T14:30:00.000Z",
    especialidad: { id: "10000000-0000-4000-8000-000000000002", nombre: "Cardiología" },
    medico: { id: "20000000-0000-4000-8000-000000000002", nombre: "Dr. Carlos Rojas" },
    consultorio: { id: "50000000-0000-4000-8000-000000000001", codigo: "C-101", nombre: "Consultorio 101" },
  },
} as const;

let server: ReturnType<typeof startStandaloneServer>;

async function instalarMocks(page: Page) {
  await page.route("**/api/disponibilidad?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      especialidad: detalle.slot.especialidad,
      zonaHoraria: "America/Lima",
      horizonte: { desde: "2026-07-17", hastaExclusiva: "2026-08-14", fechas: ["2026-07-20"] },
      items: [{
        id: SLOT_ID,
        fechaLima: "2026-07-20",
        inicioUtc: detalle.slot.inicioUtc,
        finUtc: detalle.slot.finUtc,
        medico: detalle.slot.medico,
        consultorio: detalle.slot.consultorio,
      }],
    }),
  }));
  await page.route("**/api/citas", (route) => route.fulfill({
    status: 409,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "SLOT_NO_DISPONIBLE", message: "Conflicto" } }),
  }));
  await page.route("**/api/citas/consulta", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "CITA_NO_ENCONTRADA", message: "No encontrada" } }),
  }));
}

async function axe(page: Page, resultados: string[]) {
  const analysis = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  resultados.push(...analysis.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}:${node.target.join(" ")}:${node.failureSummary ?? ""}`),
  ));
}

test.beforeAll(async () => {
  server = startStandaloneServer(PORT);
  await waitForServer(BASE_URL);
});

test.afterAll(() => server.kill());

test("único barrido de pantallas 05–08: error, teclado, foco, targets y axe (FLOW-7.2)", async ({ page }) => {
  const violaciones: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await instalarMocks(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(DATA_URL);
  await page.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(page.getByLabel("DNI (8 números)")).toBeFocused();
  await page.getByLabel("DNI (8 números)").fill("12345678");
  await page.getByLabel("Nombre completo").fill("Ana Quispe");
  await page.getByLabel("Número de celular (9 dígitos)").fill("987654321");
  await page.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(page.locator(".booking-form-error")).toBeFocused();
  await expect(page.locator(".booking-form-error")).toContainText("ya no está disponible");
  await axe(page, violaciones);

  await page.goto(`${BASE_URL}/mi-cita`);
  await page.getByLabel("DNI").fill("12345678");
  await page.getByLabel("Código de reserva").fill("SV-JKMNPQRS");
  await page.getByRole("button", { name: "Buscar cita" }).click();
  await expect(page.locator(".lookup-error")).toBeFocused();
  await expect(page.locator(".lookup-error")).toContainText("No encontramos una cita");
  await axe(page, violaciones);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate((payload) => {
    sessionStorage.setItem("senal-de-vida:confirmacion-cita", JSON.stringify(payload));
    sessionStorage.setItem("senal-de-vida:detalle-mi-cita", JSON.stringify({
      detalle: { ...payload, estado: "CANCELADA", motivoCancelacion: "PACIENTE", canceladaEn: "2026-07-17T16:00:00.000Z" },
      dni: "12345678",
      codigoReserva: payload.codigoReserva,
    }));
  }, detalle);
  await page.goto(`${BASE_URL}/reservar/confirmacion`);
  await expect(page.getByRole("heading", { name: "Tu cita está reservada" })).toBeVisible();
  await axe(page, violaciones);
  await page.goto(`${BASE_URL}/mi-cita`);
  await page.evaluate((payload) => sessionStorage.setItem(
    "senal-de-vida:detalle-mi-cita",
    JSON.stringify({ detalle: payload, dni: "12345678", codigoReserva: payload.codigoReserva }),
  ), detalle);
  await page.reload();
  await page.getByRole("button", { name: "Cancelar cita" }).click();
  await expect(page.getByRole("button", { name: "Sí, cancelar cita" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Cancelar cita" })).toBeFocused();
  await page.evaluate((payload) => sessionStorage.setItem(
    "senal-de-vida:detalle-mi-cita",
    JSON.stringify({
      detalle: { ...payload, estado: "CANCELADA", motivoCancelacion: "PACIENTE", canceladaEn: "2026-07-17T16:00:00.000Z" },
      dni: "12345678",
      codigoReserva: payload.codigoReserva,
    }),
  ), detalle);
  await page.reload();
  await expect(page.getByText("Cita cancelada").first()).toBeVisible();
  await axe(page, violaciones);

  const controlesPequenos = await page.locator("a:visible, button:visible, input:visible").evaluateAll((nodes) =>
    nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width < 48 || rect.height < 48;
    }).map((node) => ({ tag: node.tagName, text: node.textContent?.trim(), aria: node.getAttribute("aria-label") })),
  );
  expect(controlesPequenos).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  expect(violaciones).toEqual([]);
});
