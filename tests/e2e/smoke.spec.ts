import { expect, test, type Page } from "@playwright/test";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

test.describe("public routes", () => {
  const cases: [string, RegExp][] = [
    ["/", /First steps/],
    ["/campaign", /Campaign/],
    ["/campaign/lvl1", /First steps/],
    ["/campaign/lvl20", /Level 20/],
    ["/2026-01-03", /No daily on this day/],
    ["/rules", /How to play/],
    ["/stats", /My stats/],
    ["/about", /About/],
  ];
  for (const [path, title] of cases) {
    test(`${path} renders`, async ({ page }) => {
      await page.goto(path);
      await expect(heading(page)).toHaveText(title);
      await expect(page.getByRole("contentinfo").getByRole("link", { name: "About" })).toBeVisible();
    });
  }

  test("unknown paths show 404", async ({ page }) => {
    for (const path of ["/nowhere", "/campaign/lvl21", "/03-10-2026", "/editor", "/admin/"]) {
      await page.goto(path);
      await expect(heading(page), path).toHaveText("Not found");
    }
  });

  test("links navigate without a full page load", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 42));
    await page.getByRole("link", { name: "Campaign" }).first().click();
    await expect(page).toHaveURL(/\/campaign$/);
    await expect(heading(page)).toHaveText("Campaign");
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(42);
    await page.goBack();
    await expect(heading(page)).toHaveText("First steps");
  });

  test("no horizontal scrolling", async ({ page }) => {
    await page.goto("/campaign/lvl1");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("themes", () => {
  test("light and dark colour schemes", async ({ page }) => {
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    expect(await bg()).toBe("rgb(238, 241, 230)");
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await bg()).toBe("rgb(18, 23, 15)");
  });
});

test("fonts: woff2 only, the display and body fonts are preloaded and used", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "font") fonts.push(r.url());
  });
  await page.goto("/campaign/lvl1");
  await expect(heading(page)).toHaveText(/First steps/);
  const preloads = await page
    .locator('link[rel="preload"][as="font"]')
    .evaluateAll((ls) => ls.map((l) => (l as HTMLLinkElement).href));
  expect(preloads).toHaveLength(2);
  expect(preloads.join(" ")).toMatch(/bagel-fat-one-latin-400.*atkinson-hyperlegible-latin-400/);
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.length).toBeGreaterThan(0);
  for (const f of fonts) expect(f).toMatch(/\.woff2$/);
  // Each preloaded file is actually used by the page.
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`),
  );
  expect(loaded).toEqual(expect.arrayContaining(["Bagel Fat One 400", "Atkinson Hyperlegible 400"]));
});

test("the page source has a descriptive title and an h1 for crawlers that don't run scripts", async ({
  request,
}) => {
  const html = await (await request.get("/campaign")).text();
  expect(html).toMatch(/<title>Long Way Around – a daily detour puzzle<\/title>/);
  expect(html).toMatch(/<h1>Long Way Around<\/h1>/);
});
