/** Dailies are bundled with the app: the e2e build uses tests/fixtures/daily (2026-01-01, -05, -07). */
import { expect, test, type Page } from "@playwright/test";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

test("/ opens the latest daily without a history entry; it plays and counts once", async ({ page }) => {
  await page.goto("/campaign");
  await page.goto("/");
  await expect(page).toHaveURL(/\/2026-01-07$/);
  await expect(heading(page)).toHaveText("First steps");
  await expect(page.locator(".brief .eyebrow")).toHaveText("2026-01-07");
  await expect(page.locator(".hud .pill.score .v")).toHaveText("12");
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dailies" }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Submit" }).click();
  const dialog = page.getByRole("dialog", { name: "Your score" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".leaderboard-note")).toHaveText("Scores stay in this browser.");
  await dialog.click({ position: { x: -10, y: -10 } }); // the backdrop closes it
  await expect(dialog).toBeHidden();
  await expect(page.locator(".play .controls .pill.optimum")).toHaveText("Optimal:14");
  await expect(page.getByRole("button", { name: "Submitted" })).toBeDisabled();

  await page.goBack();
  await expect(page).toHaveURL(/\/campaign$/);

  await page.goto("/stats");
  await expect(heading(page)).toHaveText("My stats");
  await expect(page.locator(".stats-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".stats-table tbody tr td").first()).toHaveText(/2026-01-07/);
});

test("empty days say so, the archive navigates", async ({ page }) => {
  await page.goto("/2026-01-06");
  await expect(heading(page)).toHaveText("No daily on this day");
  await page.getByRole("link", { name: "Play the latest daily" }).click();
  await expect(page).toHaveURL(/\/2026-01-07$/);

  await expect(heading(page)).toHaveText("First steps");
  await expect(page.locator(".level-nav .disabled")).toHaveText("Next →");
  await page.getByRole("link", { name: "← Previous" }).click();
  await expect(page).toHaveURL(/\/2026-01-05$/);
  await expect(heading(page)).toHaveText("Serpentine");
  await page.getByRole("link", { name: "Next →" }).click();
  await expect(page).toHaveURL(/\/2026-01-07$/);
});
