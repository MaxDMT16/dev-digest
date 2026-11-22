import { describe, it, expect } from "vitest";
import { formatUsd, formatUsdPrecise, formatTokenCount, formatTokenTotal } from "./format-usage";

const DASH = "—";

describe("formatUsd", () => {
  it.each([
    [null, DASH],
    [undefined, DASH],
    [NaN, DASH],
    [-1, DASH],
    [0, "$0"],
    [0.00001, "<$0.0001"],
    [0.0001, "$0.00010"],
    [0.00012, "$0.00012"],
    [0.000149, "$0.00015"],
    [0.00099, "$0.00099"],
    [0.000996, "$0.0010"],
    [0.00134, "$0.0013"],
    [0.0012, "$0.0012"],
    [0.009996, "$0.010"],
    [0.01, "$0.010"],
    [0.0123, "$0.012"],
    [0.014, "$0.014"],
    [0.1374, "$0.137"],
    [0.9996, "$1.00"],
    [1, "$1.00"],
    [1.234, "$1.23"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatUsd(input as number | null | undefined)).toBe(expected);
  });

  it("never produces $0.00", () => {
    const inputs = [null, undefined, NaN, -1, 0, 1e-9, 0.00001, 0.0001, 0.005, 0.009996, 0.01, 0.5, 0.9996, 1, 2];
    for (const v of inputs) expect(formatUsd(v)).not.toBe("$0.00");
  });
});

describe("formatUsdPrecise", () => {
  it("keeps full precision", () => expect(formatUsdPrecise(0.0137421)).toBe("$0.0137421"));
  it("avoids exponent notation", () => expect(formatUsdPrecise(1e-7)).toBe("$0.0000001"));
  it("dash for negative", () => expect(formatUsdPrecise(-1)).toBe(DASH));
  it("dash for missing", () => {
    expect(formatUsdPrecise(null)).toBe(DASH);
    expect(formatUsdPrecise(undefined)).toBe(DASH);
  });
});

describe("formatTokenCount", () => {
  it.each([
    [null, DASH],
    [950, "950"],
    [8213, "8.2K"],
    [1302, "1.3K"],
    [12011, "12.0K"],
    [1_234_567, "1.2M"],
    [999.5, "1.0K"],
    [999_999, "1.0M"],
    [999_949, "999.9K"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatTokenCount(input as number | null)).toBe(expected);
  });
});

describe("formatTokenTotal", () => {
  it("groups thousands", () => expect(formatTokenTotal(9119)).toBe("9,119"));
  it("dash for null", () => expect(formatTokenTotal(null)).toBe(DASH));
});
