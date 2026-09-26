import { expect, test } from "@playwright/test";

test("touch controls drive a heist on a phone", async ({ page }) => {
  await page.goto("/heists/back-door");
  await expect(page.getByRole("button", { name: "Right" })).toBeVisible();
  await page.getByRole("button", { name: "Right" }).tap();
  await expect(page.getByText(/^1$/).first()).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
