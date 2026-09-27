// lib/model-output.test.ts — runtime validation of Gemini output (and of the client-supplied `previous`).
import { describe, expect, it } from "vitest";
import { mapBriefingText, parseAnswer, parseBriefing } from "./model-output";

const valid = {
  whatChanged: " Four students dropped. ",
  insights: ["a", "b", "c", "d"],
  suggestedActions: ["Pause now", "", 42, "Repost the poll"],
  priority: "act_now",
  headline: "Possible shared connectivity issue",
};

describe("parseBriefing", () => {
  it("trims text, drops non-strings and empties, and caps lists at 3", () => {
    expect(parseBriefing(valid)).toEqual({
      whatChanged: "Four students dropped.",
      insights: ["a", "b", "c"],
      suggestedActions: ["Pause now", "Repost the poll"],
      priority: "act_now",
      headline: "Possible shared connectivity issue",
    });
  });

  it("rejects unknown priorities, missing fields and non-objects", () => {
    expect(parseBriefing({ ...valid, priority: "panic" })).toBeNull();
    expect(parseBriefing({ ...valid, headline: "  " })).toBeNull();
    expect(parseBriefing({ ...valid, insights: "not a list" })).toBeNull();
    expect(parseBriefing(null)).toBeNull();
    expect(parseBriefing([valid])).toBeNull();
  });

  it("caps very long text", () => {
    expect(parseBriefing({ ...valid, headline: "x".repeat(5000) })?.headline).toHaveLength(600);
  });

  it("maps every text field but not the priority", () => {
    const upper = mapBriefingText(parseBriefing(valid)!, (s) => s.toUpperCase());
    expect(upper.headline).toBe("POSSIBLE SHARED CONNECTIVITY ISSUE");
    expect(upper.priority).toBe("act_now");
  });
});

describe("parseAnswer", () => {
  it("accepts a declined answer with no evidence", () => {
    expect(parseAnswer({ evidence: [], answerable: false, answer: "Not measured." })).toEqual({
      evidence: [],
      answerable: false,
      answer: "Not measured.",
    });
  });

  it("requires a real boolean and a non-empty answer", () => {
    expect(parseAnswer({ evidence: [], answerable: "false", answer: "x" })).toBeNull();
    expect(parseAnswer({ evidence: [], answerable: true, answer: "" })).toBeNull();
  });
});
