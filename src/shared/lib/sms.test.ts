import { describe, expect, it } from "vitest";
import { smsEncoding, smsCost, campaignUnits } from "./sms";

describe("smsEncoding", () => {
  it("treats plain Latin as GSM-7", () => {
    expect(smsEncoding("Fees due on 5 Aug. Please pay at the office.")).toBe("GSM-7");
  });

  it("treats any Bangla as UCS-2", () => {
    expect(smsEncoding("ফি পরিশোধ করুন")).toBe("UCS-2");
    // A single Bangla character forces the WHOLE message to UCS-2.
    expect(smsEncoding("Fee due ৳500")).toBe("UCS-2");
  });

  it("keeps GSM extension characters in GSM-7", () => {
    expect(smsEncoding("50% off [today]")).toBe("GSM-7");
  });
});

describe("smsCost", () => {
  it("charges nothing for an empty body", () => {
    expect(smsCost("").segments).toBe(0);
  });

  it("uses 160/153 for GSM-7", () => {
    expect(smsCost("a".repeat(160)).segments).toBe(1);
    // 161 chars does NOT become 160+1: concatenation reserves 7 septets/part.
    expect(smsCost("a".repeat(161)).segments).toBe(2);
    expect(smsCost("a".repeat(306)).segments).toBe(2);
    expect(smsCost("a".repeat(307)).segments).toBe(3);
  });

  it("counts GSM extension characters as two septets", () => {
    // 159 plain + one "[" (2 septets) = 161 units -> spills to 2 segments.
    expect(smsCost("a".repeat(159) + "[").segments).toBe(2);
  });

  it("uses 70/67 for UCS-2 — the defect this module exists to fix", () => {
    const bangla150 = "ক".repeat(150);
    // The old code said ceil(150/160) = 1. The gateway bills 3.
    expect(Math.ceil(150 / 160)).toBe(1);
    expect(smsCost(bangla150).segments).toBe(3);
    expect(smsCost(bangla150).perSegment).toBe(67);
    expect(smsCost("ক".repeat(70)).segments).toBe(1);
    expect(smsCost("ক".repeat(71)).segments).toBe(2);
  });

  it("counts a surrogate pair as two UCS-2 units", () => {
    expect(smsCost("😀".repeat(35)).segments).toBe(1);
    expect(smsCost("😀".repeat(36)).segments).toBe(2);
  });
});

describe("campaignUnits", () => {
  it("bills segments per recipient, not recipients", () => {
    expect(campaignUnits("ক".repeat(150), 200)).toBe(600);
    expect(campaignUnits("short", 200)).toBe(200);
  });

  it("never bills for a negative recipient count", () => {
    expect(campaignUnits("hello", -5)).toBe(0);
  });
});
