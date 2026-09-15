import { test, expect } from "@playwright/test";

test("production site loads successfully", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  expect(response).not.toBeNull();
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/VATTAMS|Academia/i);
});
