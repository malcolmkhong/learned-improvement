import { describe, it, expect } from "vitest";
import { EventSchema, EVENT_TYPES, EVENT_BLACKLIST } from "./event.js";

describe("EventSchema", () => {
  it("accepts a valid event", () => {
    const result = EventSchema.safeParse({
      id: 1,
      ts: new Date().toISOString(),
      type: "TEST_FAILED",
      severity: "warn",
      error_type: "TEST_FAILED",
      source: "test",
      payload: { test_name: "x" },
      trace_id: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const result = EventSchema.safeParse({
      id: 1,
      ts: new Date().toISOString(),
      type: "NOPE",
      severity: "info",
      error_type: null,
      source: "test",
      payload: {},
      trace_id: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown severity", () => {
    const result = EventSchema.safeParse({
      id: 1,
      ts: new Date().toISOString(),
      type: "TOOL_ERROR",
      severity: "critical",
      error_type: null,
      source: "test",
      payload: {},
      trace_id: null,
    });
    expect(result.success).toBe(false);
  });

  it("blacklist contains expected noise events", () => {
    expect(EVENT_BLACKLIST.has("HEARTBEAT")).toBe(true);
    expect(EVENT_BLACKLIST.has("DAEMON_START")).toBe(true);
    expect(EVENT_BLACKLIST.has("TOOL_ERROR")).toBe(false);
  });

  it("all listed event types are in EVENT_TYPES", () => {
    for (const t of EVENT_TYPES) expect(typeof t).toBe("string");
    expect(EVENT_TYPES.length).toBeGreaterThan(20);
  });
});
