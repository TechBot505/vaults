import { expect, test } from "@playwright/test";
import { play } from "./helpers";

test("build, test-crack, and share a vault by link", async ({ page }) => {
  await page.goto("/build");
  const board = page.getByRole("img", { name: "Vault being built" });
  await expect(board).toBeVisible();
  // the Machine rates the starter vault on its own
  await expect(page.getByText(/Best possible heist/)).toBeVisible({ timeout: 20_000 });

  // draw a wall with the keyboard shortcut + a drag
  await page.keyboard.press("b");
  const box = (await board.boundingBox())!;
  const at = (x: number, y: number) => ({ x: box.x + ((x + 1.1) / 14.2) * box.width, y: box.y + ((y + 1.1) / 10.2) * box.height });
  let p = at(4, 1);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  p = at(4, 6);
  await page.mouse.move(p.x, p.y);
  await page.mouse.up();

  // undo and redo it
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+Shift+z");

  // publishing is refused before a test crack
  await page.getByRole("button", { name: /^publish$/ }).click();
  await expect(page.getByText("Crack it first")).toBeVisible();

  await page.getByRole("button", { name: /test crack/ }).click();
  await play(page, "DDDDDD" + "RRRRRRRRRR" + "LLLLLLLLLL" + "UUUUUU");
  await expect(page.getByText("Out with the loot")).toBeVisible();
  await page.getByRole("button", { name: /publish it/ }).click();

  const link = await page.getByRole("textbox", { name: "Share link" }).inputValue();
  expect(link).toContain("/play?v=");
  await page.goto(link);
  await expect(page.getByText("a vault someone dared you to crack")).toBeVisible();
});

test("a broken share link explains itself", async ({ page }) => {
  await page.goto("/play?v=not-a-vault");
  await expect(page.getByText("This vault link is broken.")).toBeVisible();
});
