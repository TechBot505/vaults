import { expect, test } from "@playwright/test";
import { getHeist } from "../../src/content/heists";
import { solve } from "../../src/engine/solver";
import { findCapture, play } from "./helpers";

test("home page shows the Machine cracking a vault", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /nobody/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /shortest one there is/ })).toBeVisible();
  await page.getByRole("link", { name: /crack your first vault/ }).click();
  await expect(page).toHaveURL(/\/heists$/);
});

test("crack the first heist and unlock the second", async ({ page }) => {
  const h = getHeist("back-door")!;
  const r = solve(h.def);
  expect(r.status).toBe("solved");
  await page.goto("/heists/back-door");
  await expect(page.getByRole("heading", { name: h.title })).toBeVisible();
  await play(page, r.status === "solved" ? r.moves : "");
  await expect(page.getByText("Out with the loot")).toBeVisible();
  await expect(page.getByText(/matched the Machine/)).toBeVisible();
  await page.getByRole("button", { name: /next heist/ }).click();
  await expect(page).toHaveURL(/\/heists\/night-shift/);
});

test("walking into a guard's sight gets you caught, and R restarts", async ({ page }) => {
  await page.goto("/heists/night-shift");
  const losing = findCapture(getHeist("night-shift")!.def);
  expect(losing).not.toBe("");
  await play(page, losing);
  await expect(page.getByRole("button", { name: /try again/ })).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: /try again/ })).toBeHidden();
});
