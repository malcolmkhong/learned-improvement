import { describe, it, expect } from "vitest";
import { RuleSchema, RULE_ACTIONS, RULE_CHECK_TYPES } from "./rule.js";

describe("RuleSchema", () => {
  const base = {
    id: "rule-1",
    condition: { type: "regex" as const, pattern: "forgot", scope: "project" as const },
    action: "warn" as const,
    priority: 5,
    status: "active" as const,
    rationale: "test rule",
    lesson_id: null,
    created_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
    archived_at: null,
    violation_count: 0,
  };

  it("accepts a valid rule", () => {
    expect(RuleSchema.safeParse(base).success).toBe(true);
  });

  it("rejects unknown action", () => {
    expect(RuleSchema.safeParse({ ...base, action: "destroy" }).success).toBe(false);
  });

  it("rejects priority outside 1..10", () => {
    expect(RuleSchema.safeParse({ ...base, priority: 0 }).success).toBe(false);
    expect(RuleSchema.safeParse({ ...base, priority: 11 }).success).toBe(false);
  });

  it("RULE_ACTIONS contains block/warn/suggest/inject", () => {
    expect(RULE_ACTIONS).toContain("block");
    expect(RULE_ACTIONS).toContain("warn");
    expect(RULE_ACTIONS).toContain("suggest");
    expect(RULE_ACTIONS).toContain("inject");
  });

  it("RULE_CHECK_TYPES contains all four check kinds", () => {
    expect(RULE_CHECK_TYPES).toContain("always");
    expect(RULE_CHECK_TYPES).toContain("regex");
    expect(RULE_CHECK_TYPES).toContain("ast");
    expect(RULE_CHECK_TYPES).toContain("shell");
  });
});
