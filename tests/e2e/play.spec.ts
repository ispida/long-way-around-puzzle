import { expect, test, type Page } from "@playwright/test";

/** Clicks the centre of board cell (x, y). */
async function clickCell(page: Page, x: number, y: number) {
  const canvas = page.locator(".board-frame canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  const w = Number(await canvas.getAttribute("data-w"));
  const h = Number(await canvas.getAttribute("data-h"));
  if (!box) throw new Error("board not visible");
  await page.mouse.click(box.x + ((x + 0.5) * box.width) / w, box.y + ((y + 0.5) * box.height) / h);
}

const score = (page: Page) => page.locator(".hud .pill.score .v");
const hedges = (page: Page) => page.locator(".hud .pill.hedges .v");
const submit = (page: Page) => page.getByRole("button", { name: "Submit" });
/** The scores pop-up that opens after the Submit. */
const scores = (page: Page) => page.getByRole("dialog", { name: "Your score" });
/** Closes the pop-up once it is open (it opens a moment after the walk). */
async function closeScores(page: Page) {
  await expect(scores(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(scores(page)).toBeHidden();
}
/** Picks a theme from the header's "Choose bear" menu. */
async function chooseTheme(page: Page, name: string) {
  await page.getByRole("button", { name: "Choose bear" }).click();
  await page.getByRole("menuitemradio", { name }).click();
}

test.beforeEach(async ({ page }) => {
  // Skip the walk animation so tests are fast; the animation itself has unit tests.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("level 1: place hedges, submit once, the optimum appears, persistence", async ({ page }) => {
  await page.goto("/campaign/lvl1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("First steps");
  await expect(page.locator(".hud .pill.score")).toHaveText("Score:12");
  await expect(score(page)).toHaveText("12");
  await expect(page.locator(".controls .pill.optimum")).toBeHidden();

  // The best layout the search finds for level 1.
  await clickCell(page, 2, 4);
  await clickCell(page, 8, 1);
  await clickCell(page, 7, 2);
  await expect(hedges(page)).toHaveText("3/3");
  await expect(score(page)).toHaveText("14");
  const firstScore = 14;

  await submit(page).click();
  // The pop-up shows this browser's score, highlighted.
  await expect(scores(page)).toBeVisible();
  await expect(scores(page).locator(".hist-col.current")).toHaveCount(1);
  await expect(scores(page).locator(".hist-col.current")).toHaveAttribute(
    "aria-label",
    `Score ${firstScore}: 1 player`,
  );
  await expect(scores(page).locator(".leaderboard-note")).toHaveCount(1);
  await scores(page).getByRole("button", { name: "Close" }).click();
  await expect(scores(page)).toBeHidden();
  // The Score pill opens it again.
  await page.locator(".hud .pill.score").click();
  await expect(scores(page)).toBeVisible();
  await page.keyboard.press("Escape");

  // One Submit only: the button stays off; Clear, Best (back to the best layout), the optimum and its layout
  // are all that's left.
  await expect(page.locator("section.result")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submitted" })).toBeDisabled();
  await expect(page.locator(".play .controls > :not([hidden])")).toHaveText([
    "Submitted",
    "Clear",
    "Best: 14",
    "Optimal:14",
    "Show optimal layout",
  ]);
  // The board stays editable for trying things out.
  await clickCell(page, 2, 4);
  await expect(hedges(page)).toHaveText("2/3");
  await expect(page.getByRole("button", { name: "Submitted" })).toBeDisabled();

  // Reload: the submitted layout comes back, Submit stays off; the campaign shows the score and unlocks level 2.
  await page.reload();
  await expect(hedges(page)).toHaveText("3/3");
  await expect(score(page)).toHaveText(String(firstScore));
  await expect(page.getByRole("button", { name: "Submitted" })).toBeDisabled();
  await page.goto("/campaign");
  const card1 = page.locator(".level-card").nth(0);
  await expect(card1).toContainText(`${firstScore} jars saved`);
  await expect(page.locator(".level-card").nth(1)).not.toContainText("Locked");
  await expect(page.locator(".level-card").nth(2)).toContainText("Locked");
});

test("campaign: every tile has the same size and a picture; locked and coming ones are veiled", async ({
  page,
}) => {
  await page.goto("/campaign");
  await expect(page.locator(".page .eyebrow, .page .lead")).toHaveCount(0);
  const cards = page.locator(".level-card");
  await expect(cards).toHaveCount(20);
  await expect(page.locator(".level-card .thumb canvas")).toHaveCount(20);
  await expect(page.locator(".level-card").nth(0).locator(".veil")).toHaveCount(0);
  await expect(page.locator(".level-card").nth(1).locator(".veil")).toHaveText("Locked");
  await expect(page.locator(".level-card").nth(19).locator(".veil")).toHaveText("Coming soon");
  await expect(page.locator(".level-card").nth(1).locator("a")).toHaveCount(0);
  const sizes = await cards.evaluateAll((els) =>
    els.map(
      (e) => `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`,
    ),
  );
  expect(new Set(sizes).size).toBe(1);
});

test("a hedge that would cut the animal off is refused, and the animal says so", async ({ page }) => {
  await page.goto("/campaign/lvl1");
  await clickCell(page, 3, 0);
  await clickCell(page, 3, 4); // would close the last gap
  await expect(hedges(page)).toHaveText("1/3");
  await expect(score(page)).toHaveText("12");
  await expect(submit(page)).toBeEnabled();
  const bubble = page.locator(".board-frame .speech");
  await expect(bubble).toBeVisible();
  const line = (await bubble.textContent()) ?? "";
  expect(line.length).toBeGreaterThan(3);
  await expect(page.locator(".play .sr-only[aria-live]")).toHaveText(line);
  await expect(bubble).toBeHidden({ timeout: 5000 });
});

test("the level layout: no description, no status pill, small Submit, Clear and Best only, no scrolling", async ({
  page,
}) => {
  await page.goto("/campaign/lvl1");
  await expect(page.locator(".brief .lead, .brief .meta, .hud .status, .pips")).toHaveCount(0);
  await expect(page.locator(".play .controls > :not([hidden])")).toHaveText(["Submit", "Clear", "Best: 12"]);
  const fits = () => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
  expect(await fits()).toBe(true);
  await submit(page).click();
  await closeScores(page);
  expect(await fits()).toBe(true);
});

test("previous and next level buttons at the top", async ({ page }) => {
  await page.goto("/campaign/lvl1");
  const nav = page.locator(".level-nav");
  await expect(nav.locator("[aria-disabled=true]")).toHaveText(["← Previous level", "Next level →"]);
  await submit(page).click();
  await closeScores(page);
  await expect(nav.getByRole("link", { name: "Next level →" })).toBeVisible();
  await nav.getByRole("link", { name: "Next level →" }).click();
  await expect(page).toHaveURL(/\/campaign\/lvl2$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Serpentine");
  await nav.getByRole("link", { name: "← Previous level" }).click();
  await expect(page).toHaveURL(/\/campaign\/lvl1$/);
});

test("the budget limits hedges and grass-only placement is enforced", async ({ page }) => {
  await page.goto("/campaign/lvl1");
  await clickCell(page, 3, 1); // tree: not allowed
  await expect(hedges(page)).toHaveText("0/3");
  for (const [x, y] of [
    [1, 0],
    [1, 1],
    [1, 3],
    [1, 4],
  ] as const)
    await clickCell(page, x, y);
  await expect(hedges(page)).toHaveText("3/3");
});

test("keyboard play: Tab to the board, arrows and Space place a hedge", async ({ page }) => {
  await page.goto("/campaign/lvl1");
  await page.locator(".board-frame canvas").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(hedges(page)).toHaveText("1/3");
  await expect(page.locator(".play .sr-only[aria-live]")).toContainText("jars saved. 2 logs left.");
});

test("locked and unknown levels explain themselves", async ({ page }) => {
  await page.goto("/campaign/lvl3");
  await expect(page.locator("main")).toContainText("still locked");
  await page.goto("/campaign/lvl15");
  await expect(page.locator("main")).toContainText("doesn't exist yet");
});

test("the theme switch changes pictures' words and is remembered", async ({ page }) => {
  await page.goto("/campaign/lvl1");
  await expect(page.locator(".play .sr-only").first()).toContainText("route the bear will take");
  await clickCell(page, 3, 0);
  // Only the button shows; the menu opens below it.
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.locator(".site-header select")).toHaveCount(0);
  await chooseTheme(page, "Panda");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.locator(".play .sr-only").first()).toContainText("route the panda will take");
  await expect(hedges(page)).toHaveText("1/3"); // unsaved hedges survive the switch
  await page.reload();
  const button = page.getByRole("button", { name: "Choose bear" });
  await button.click();
  await expect(page.getByRole("menuitemradio")).toHaveText(["Brown bear", "Panda", "Ice bear"]);
  await expect(page.getByRole("menuitemradio", { name: "Panda" })).toHaveAttribute("aria-checked", "true");
  const menu = (await page.getByRole("menu").boundingBox())!;
  const btn = (await button.boundingBox())!;
  expect(menu.y).toBeGreaterThanOrEqual(btn.y + btn.height);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await button.click();
  await page.mouse.click(5, 500); // outside the menu
  await expect(page.getByRole("menu")).toBeHidden();
});

test("the bear menu works the Safari way: a tapped entry doesn't take focus", async ({ page }) => {
  await page.goto("/campaign/lvl1");
  await page.getByRole("button", { name: "Choose bear" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  // Safari doesn't focus a tapped button: the focused entry just loses focus, to nothing.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitemradio", { name: "Ice bear" }).dispatchEvent("click");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.locator(".play .sr-only").first()).toContainText("route the ice bear will take");
});

test("the rulebook: one Rules grid, equal 4 × 7 pictures, titles in line, short texts", async ({ page }) => {
  await page.goto("/rules");
  await expect(page.locator(".rules-page .lead, .card .cap")).toHaveCount(0);
  await expect(page.locator(".rules-page h2")).toHaveText(["Rules"]);
  await expect(page.locator(".card")).toHaveCount(9);
  await expect(page.locator(".card h3")).toContainText([
    "1. It saves as little as it can",
    "Mud",
    "Portals",
    "Beehive",
  ]);
  await expect(page.locator(".card", { hasText: "Portals" }).locator("p")).toHaveText(
    "Two portals connected in 1 step.",
  );
  await expect(page.locator(".card", { hasText: "Beehive" }).locator("p")).toHaveText(
    "Beehive adds 5 jars, so the bear walks up to 5 extra steps to get around it.",
  );
  const boxes = await page.locator(".card").evaluateAll((cards) =>
    cards.map((c) => {
      const pic = c.querySelector("canvas")!.getBoundingClientRect();
      const h3 = c.querySelector("h3")!.getBoundingClientRect();
      return {
        w: Math.round(pic.width),
        h: Math.round(pic.height),
        top: Math.round(pic.top),
        title: Math.round(h3.top),
      };
    }),
  );
  expect(new Set(boxes.map((b) => `${b.w}x${b.h}`)).size).toBe(1);
  for (const b of boxes)
    expect(Math.abs(b.title - b.top - (boxes[0]!.title - boxes[0]!.top))).toBeLessThanOrEqual(1);
});

for (const theme of ["Panda", "Ice bear"]) {
  test(`plays and submits in the ${theme} theme`, async ({ page }) => {
    await page.goto("/campaign/lvl1");
    await chooseTheme(page, theme);
    await clickCell(page, 8, 1);
    await submit(page).click();
    await expect(page.getByRole("button", { name: "Submitted" })).toBeDisabled();
    await expect(page.locator(".play .sr-only").first()).toContainText(
      `route the ${theme.toLowerCase()} will take`,
    );
  });
}

test("story wording: saved score, themed pieces and the walking line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/campaign/lvl1");
  await expect(page.locator(".hud .pill.hedges .label")).toHaveText("Logs");
  await chooseTheme(page, "Ice bear");
  await expect(score(page)).toHaveText("12");
  await expect(page.locator(".hud .pill.hedges .label")).toHaveText("Ice walls");
  await submit(page).click();
  await expect(page.locator(".walk-line")).toHaveText("The puffins are saving fish…");
  await expect(page.locator(".walk-line")).toBeHidden({ timeout: 10000 });
  await expect(page.locator(".play .sr-only[aria-live]")).toContainText("12 fish saved");
});

test("after Submit the proven optimum shows and its layout can be shown", async ({ page }) => {
  await page.goto("/campaign/lvl1");
  await submit(page).click(); // no hedges: 12
  await closeScores(page);
  const result = page.locator(".play .controls");
  await expect(result.locator(".pill.optimum")).toHaveText("Optimal:14");
  const canvas = page.locator(".board-frame canvas");
  await expect(canvas).toHaveAttribute("data-showing", "own");
  // The board shows the optimal layout itself: its pieces, its route and its score.
  await result.getByRole("button", { name: "Show optimal layout" }).click();
  await expect(canvas).toHaveAttribute("data-showing", "optimal");
  await expect(hedges(page)).toHaveText("3/3");
  await expect(score(page)).toHaveText("14");
  await result.getByRole("button", { name: "Hide optimal layout" }).click();
  await expect(canvas).toHaveAttribute("data-showing", "own");
  await expect(hedges(page)).toHaveText("0/3");
  await expect(score(page)).toHaveText("12");
  // A tap on the board also goes back to the player's own layout, without placing anything.
  await result.getByRole("button", { name: "Show optimal layout" }).click();
  await clickCell(page, 4, 0);
  await expect(canvas).toHaveAttribute("data-showing", "own");
  await expect(hedges(page)).toHaveText("0/3");
});

test("after the hive rule change a level with hives can be submitted again, the others stay", async ({
  page,
}) => {
  // Records saved before the change: levels 1–6 submitted, no rule tags yet. Test level 6 has hives.
  await page.addInitScript(() => {
    if (localStorage.getItem("lwr:v1")) return;
    const sub = { score: 9, steps: 9, bonus: 0, placements: [], at: "2026-10-07T10:00:00Z", sent: true };
    const levels = Object.fromEntries(
      ["lvl01", "lvl02", "lvl03", "lvl04", "lvl05", "lvl06"].map((id) => [
        id,
        { counted: sub, attempts: [] },
      ]),
    );
    localStorage.setItem("lwr:v1", JSON.stringify({ v: 1, settings: {}, levels, campaignVersion: 1 }));
  });
  await page.goto("/campaign/lvl5");
  await expect(page.getByRole("button", { name: "Submitted" })).toBeDisabled();
  await page.goto("/campaign/lvl6");
  await expect(submit(page)).toBeEnabled();
  // The next level stays open: level 6 was finished, under the old rules.
  await page.goto("/campaign/lvl7");
  await expect(submit(page)).toBeEnabled();
  await page.reload();
  await page.goto("/campaign/lvl6");
  await expect(submit(page)).toBeEnabled();
});

test("the board remembers the best layout tried: back to it after Clear, and after a reload", async ({
  page,
}) => {
  await page.goto("/campaign/lvl1");
  const back = page.getByRole("button", { name: /^Best:/ });
  // Nothing tried yet: the button is there but off, so nothing moves once a best appears.
  await expect(back).toHaveText("Best: 12");
  await expect(back).toBeDisabled();
  const before = await submit(page).boundingBox();
  await clickCell(page, 2, 4);
  expect(await submit(page).boundingBox()).toEqual(before); // Submit stays put under the finger
  await clickCell(page, 8, 1);
  await clickCell(page, 7, 2);
  await expect(score(page)).toHaveText("14");
  await expect(back).toHaveText("Best: 14");
  await expect(back).toBeDisabled(); // the board already shows it

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(score(page)).toHaveText("12");
  await clickCell(page, 4, 0);
  await expect(back).toBeEnabled();
  await back.click();
  await expect(score(page)).toHaveText("14");
  await expect(hedges(page)).toHaveText("3/3");

  // Not submitted: a revisit starts from the best layout.
  await page.getByRole("button", { name: "Clear" }).click();
  await page.reload();
  await expect(score(page)).toHaveText("14");
  await expect(back).toBeDisabled();
});
