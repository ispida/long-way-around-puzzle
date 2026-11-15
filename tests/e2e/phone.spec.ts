/** A 16-column board (the 2026-01-01 fixture daily) fits common phone widths without sideways scrolling. */
import { expect, test } from "@playwright/test";

for (const width of [360, 390, 412]) {
  test(`a 16×15 board fits a ${width} px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/2026-01-01");
    const canvas = page.locator(".board-frame canvas");
    await expect(canvas).toHaveAttribute("data-w", "16");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);

    const box = (await canvas.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.width / 16).toBeGreaterThanOrEqual(20);
    // The last column is reachable: a hedge goes on row 2, column 16.
    await page.mouse.click(box.x + box.width - box.width / 32, box.y + (1.5 * box.height) / 15);
    await expect(page.locator(".hud .pill.hedges .v")).toHaveText("1/2");
  });
}
