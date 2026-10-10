import { test, expect } from "@playwright/test";

test("production site loads successfully", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  expect(response).not.toBeNull();
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/VATTAMS|Academia/i);
});

test("Courses pillar catalogue renders without an application error", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const response = await page.goto("/courses", { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Explore Courses" })).toBeVisible();
  expect(pageErrors, "Courses catalogue emitted uncaught browser errors").toEqual([]);
});

test("Competitive and Entrance Exams pillar renders without an application error", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const response = await page.goto("/competitive-exams", { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", {
    name: "Competitive exam preparation built for serious learners",
  })).toBeVisible();
  expect(pageErrors, "Competitive exam catalogue emitted uncaught browser errors").toEqual([]);
});
