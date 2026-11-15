import { describe, expect, it } from "vitest";
import { matchRoute, pathOf } from "./routes";

describe("matchRoute", () => {
  it("matches fixed pages, with or without trailing slash", () => {
    expect(matchRoute("/")).toEqual({ name: "home" });
    expect(matchRoute("/campaign")).toEqual({ name: "campaign" });
    expect(matchRoute("/campaign/")).toEqual({ name: "campaign" });
    expect(matchRoute("/about")).toEqual({ name: "about" });
  });
  it("matches campaign levels 1 to 20 only", () => {
    expect(matchRoute("/campaign/lvl1")).toEqual({ name: "level", n: 1 });
    expect(matchRoute("/campaign/lvl20")).toEqual({ name: "level", n: 20 });
    expect(matchRoute("/campaign/lvl0").name).toBe("not-found");
    expect(matchRoute("/campaign/lvl21").name).toBe("not-found");
    expect(matchRoute("/campaign/lvl01").name).toBe("not-found");
  });
  it("matches ISO daily dates, including future ones", () => {
    expect(matchRoute("/2026-10-03")).toEqual({ name: "daily", date: "2026-10-03" });
    expect(matchRoute("/2099-01-01")).toEqual({ name: "daily", date: "2099-01-01" });
    expect(matchRoute("/03-10-2026").name).toBe("not-found");
    expect(matchRoute("/2026-02-30").name).toBe("not-found");
  });
  it("has no editor route", () => {
    expect(matchRoute("/editor").name).toBe("not-found");
  });
  it("round-trips through pathOf", () => {
    for (const p of ["/", "/campaign", "/campaign/lvl7", "/2026-10-03", "/stats", "/about"]) {
      expect(pathOf(matchRoute(p))).toBe(p);
    }
  });
});
