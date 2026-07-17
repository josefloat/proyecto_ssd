import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { startStandaloneServer, waitForServer } from "./helpers";

const PORT = 3127;
const BASE_URL = `http://localhost:${PORT}`;
const ESPECIALIDAD_ID = "22222222-2222-4222-8222-222222222222";
const MEDICO_ID = "77777777-7777-4777-8777-777777777777";
const SLOT_ID = "99999999-9999-4999-8999-999999999999";
const especialidades = { items: [{ id: ESPECIALIDAD_ID, nombre: "Cardiología" }] };
const medicos = {
  especialidad: { id: ESPECIALIDAD_ID, nombre: "Cardiología" },
  items: [{ id: MEDICO_ID, nombre: "Dra. Ana Huamán" }],
};
const disponibilidad = {
  especialidad: medicos.especialidad,
  zonaHoraria: "America/Lima",
  horizonte: {
    desde: "2026-07-17",
    hastaExclusiva: "2026-08-14",
    fechas: Array.from({ length: 28 }, (_, index) => {
      const date = new Date("2026-07-17T12:00:00.000Z");
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    }),
  },
  items: [
    {
      id: SLOT_ID,
      fechaLima: "2026-07-17",
      inicioUtc: "2026-07-17T14:00:00.000Z",
      finUtc: "2026-07-17T14:30:00.000Z",
      medico: medicos.items[0],
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

async function instalarApiLista(page: Page) {
  await page.route("**/api/especialidades", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(especialidades) }));
  await page.route("**/api/especialidades/*/medicos", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(medicos) }));
  await page.route("**/api/disponibilidad?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(disponibilidad) }));
}

async function assertAccessible(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  const smallTargets = await page.locator("button:not([disabled]), a[href]").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: element.textContent?.trim(), width: rect.width, height: rect.height };
      })
      .filter(({ width, height }) => width < 48 || height < 48),
  );
  expect(smallTargets).toEqual([]);
  const smallText = await page.locator("h1,h2,p,button,a,small,span").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return Boolean(element.textContent?.trim()) && rect.width > 1 && rect.height > 1 && !element.classList.contains("sr-only");
      })
      .map((element) => ({ text: element.textContent?.trim(), size: Number.parseFloat(getComputedStyle(element).fontSize) }))
      .filter(({ size }) => size < 18),
  );
  expect(smallText).toEqual([]);
}

for (const viewport of [
  { name: "móvil", width: 390, height: 844 },
  { name: "escritorio", width: 1440, height: 1100 },
]) {
  test(`axe, texto y targets pasan en cuatro pantallas — ${viewport.name} (FLOW-5.1)`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await instalarApiLista(page);
    const urls = [
      BASE_URL,
      `${BASE_URL}/reservar/especialidad?especialidadId=${ESPECIALIDAD_ID}`,
      `${BASE_URL}/reservar/medico?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}`,
      `${BASE_URL}/reservar/fecha-hora?especialidadId=${ESPECIALIDAD_ID}&medicoId=${MEDICO_ID}&fechaLima=2026-07-17&slotId=${SLOT_ID}`,
    ];
    for (const url of urls) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("h1")).toBeVisible();
      await assertAccessible(page);
      await page.keyboard.press("Tab");
      const focus = page.locator(":focus");
      await expect(focus).toBeVisible();
      const outline = await focus.evaluate((element) => getComputedStyle(element).outlineStyle);
      expect(outline).not.toBe("none");
    }
  });
}

test("teclado selecciona una especialidad sin depender del color (FLOW-5.1)", async ({ page }) => {
  await instalarApiLista(page);
  await page.goto(`${BASE_URL}/reservar/especialidad`);
  const card = page.getByRole("button", { name: "Cardiología" });
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/especialidadId=/);
});

test("loading, preparing, empty, invalid y error tienen anuncios accesibles (FLOW-5.1)", async ({ page }) => {
  const cases = [
    {
      name: "loading",
      handler: (route: import("@playwright/test").Route) => new Promise<void>(() => void route),
      expected: "Cargando opciones…",
    },
    { name: "preparing", handler: (route: import("@playwright/test").Route) => route.fulfill({ status: 504, body: "{}" }), expected: "Estamos preparando el sistema" },
    { name: "empty", handler: (route: import("@playwright/test").Route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }), expected: "No hay especialidades disponibles" },
    { name: "error", handler: (route: import("@playwright/test").Route) => route.fulfill({ status: 500, body: "{}" }), expected: "No pudimos cargar las especialidades" },
  ];
  for (const state of cases) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.route("**/api/especialidades", state.handler);
    await page.goto(`${BASE_URL}/reservar/especialidad`);
    await expect(page.getByText(state.expected, { exact: false }).first()).toBeVisible();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations, state.name).toEqual([]);
  }

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/api/especialidades/*/medicos", (route) => route.fulfill({ status: 404, body: "{}" }));
  await page.goto(`${BASE_URL}/reservar/medico?especialidadId=${ESPECIALIDAD_ID}`);
  await expect(page.getByRole("heading", { name: "Elige primero una especialidad" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("offline se anuncia y el reintento manual recupera ready (FLOW-3.3/FLOW-5.1)", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  });
  await page.route("**/api/especialidades", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(especialidades) }));
  await page.goto(`${BASE_URL}/reservar/especialidad`);
  await expect(page.getByRole("heading", { name: "Parece que no tienes conexión" })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  });
  await page.getByRole("button", { name: "Intentar nuevamente" }).click();
  await expect(page.getByRole("button", { name: "Cardiología" })).toBeVisible();
});
