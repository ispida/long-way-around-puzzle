import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("the first visit opens a short How to play pop-up, once", async ({ page }) => {
  await page.goto("/campaign/lvl1");
  const intro = page.getByRole("dialog", { name: "How to play" });
  await expect(intro).toBeVisible();
  await expect(intro).toContainText("The bear wants to reach the honey fast.");
  await expect(intro.locator("em")).toHaveText("the long way around");
  await expect(intro.locator("li")).toHaveText([
    "Place logs to make his way longer.",
    "Do not enclose the bear.",
    "Try making the bear switch direction to gain more points.",
    "Enjoy playing!",
  ]);
  await intro.getByRole("button", { name: "Let's go" }).click();
  await expect(intro).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "How to play" })).toBeHidden();
});
