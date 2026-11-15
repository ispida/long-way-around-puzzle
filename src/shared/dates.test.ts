import { describe, expect, it } from "vitest";
import { isIsoDate, isPublished, todayKey } from "./dates";

describe("isIsoDate", () => {
  it("accepts real dates", () => {
    expect(isIsoDate("2026-10-03")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
  it("rejects malformed or impossible dates", () => {
    for (const s of ["03-10-2026", "2026-10-3", "2026-02-30", "2027-02-29", "2026-13-01", "", "x"]) {
      expect(isIsoDate(s), s).toBe(false);
    }
  });
});

describe("todayKey / isPublished", () => {
  const now = new Date("2026-10-03T23:59:59Z");
  it("uses UTC", () => {
    expect(todayKey(now)).toBe("2026-10-03");
    expect(todayKey(new Date("2026-10-04T00:00:00Z"))).toBe("2026-10-04");
  });
  it("publishes today and earlier, never later", () => {
    expect(isPublished("2026-10-03", now)).toBe(true);
    expect(isPublished("2026-01-01", now)).toBe(true);
    expect(isPublished("2026-10-04", now)).toBe(false);
    expect(isPublished("not-a-date", now)).toBe(false);
  });
});
