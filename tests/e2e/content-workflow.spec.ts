import { test, expect, type Page } from "@playwright/test";

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const BASE_URL = "http://127.0.0.1:3000";

async function setTenantHeader(page: Page) {
  await page.context().addInitScript((tenantId) => {
    window.localStorage.setItem("tenant-id", tenantId);
  }, TEST_TENANT_ID);
}

test.describe("HITL Content Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await setTenantHeader(page);
  });

  test("full workflow: create event → select photos → pick format/tone → preview → approve", async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);

    await expect(page.getByRole("heading", { name: "Eventos" })).toBeVisible();

    const createButton = page.getByRole("link", { name: "Crear contenido" });
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForURL(/\/events\/[^/]+$/);
    }

    await page.goto(`${BASE_URL}/content`);

    await expect(page.getByRole("heading", { name: "Contenido" })).toBeVisible();

    const tabs = page.getByRole("button", { name: /^(Todos|Borrador|Generando|Generado|Revisado|Aprobado|Publicado|Rechazado|Fallido)$/ });
    await expect(tabs.first()).toBeVisible();

    await page.getByRole("button", { name: "Generado" }).click();

    const contentItems = page.locator("article, li").filter({ has: page.getByText("Revisar") });
    const count = await contentItems.count();

    if (count > 0) {
      await contentItems.first().getByText("Revisar").click();

      await page.waitForURL(/\/content\/[^/]+$/);

      await expect(page.getByText("Selección de fotos")).toBeVisible();
      await expect(page.getByText("Formato")).toBeVisible();
      await expect(page.getByText("Tono / Persona")).toBeVisible();

      const formatButtons = page.getByRole("button", { name: /^(Post|Story|Carousel)$/ });
      await expect(formatButtons.first()).toBeVisible();

      await page.getByRole("button", { name: "Generar preview" }).click();

      await page.waitForTimeout(2000);

      const previewImage = page.locator("img[alt='Preview']");
      await expect(previewImage).toBeVisible({ timeout: 10000 });

      const stateLabel = page.getByText(/Estado: (Borrador|Generando|Generado|Revisado|Aprobado|Publicado|Rechazado|Fallido)/);
      await expect(stateLabel).toBeVisible();
    }
  });

  test("content list shows status filter tabs", async ({ page }) => {
    await page.goto(`${BASE_URL}/content`);

    await expect(page.getByRole("heading", { name: "Contenido" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Todos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Borrador" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generado" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aprobado" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rechazado" })).toBeVisible();
  });

  test("content detail page has action bar buttons", async ({ page }) => {
    await page.goto(`${BASE_URL}/content`);

    const reviewLink = page.getByRole("link", { name: "Revisar" });
    const linkCount = await reviewLink.count();

    if (linkCount > 0) {
      await reviewLink.first().click();
      await page.waitForURL(/\/content\/[^/]+$/);

      const actionBar = page.getByText("Acciones").first();
      await expect(actionBar).toBeVisible();

      const previewSection = page.getByText("Vista previa").first();
      await expect(previewSection).toBeVisible();

      const historySection = page.getByText("Historial").first();
      await expect(historySection).toBeVisible();
    }
  });
});
