import { describe, expect, it } from "vitest";
import { loadContent } from "../../tools/content-io";
import { loadGameContent } from "@app/content";

describe("browser content", () => {
  it("bundles the same content the tools load", async () => {
    const browser = loadGameContent();
    const node = loadContent();
    expect(browser.registry.tiles).toEqual(node.registry.tiles);
    expect(browser.registry.pieces).toEqual(node.registry.pieces);
    expect([...browser.registry.rulesets.keys()]).toEqual([...node.registry.rulesets.keys()]);
    expect(browser.campaign.levels).toEqual(node.levels.map((l) => l.id));
    for (const id of browser.campaign.levels) {
      expect(await browser.loadCampaignLevel(id)).toEqual(node.levels.find((l) => l.id === id));
    }
    expect(await browser.loadCampaignLevel("lvl99")).toBeUndefined();
  });
});
