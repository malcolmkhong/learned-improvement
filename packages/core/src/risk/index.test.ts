import { describe, it, expect } from "vitest";
import { classify, HARD_STOP_CATEGORIES, RISK_TIERS } from "./index.js";
import { DEFAULT_CONFIG } from "../config.js";

function classifyAt(kind: Parameters<typeof classify>[0]["kind"], config = DEFAULT_CONFIG) {
  return classify({ id: "test", kind, rationale: "test", sourceRuleId: null, sourceLessonId: null }, config);
}

describe("Risk Classifier", () => {
  it("exposes the canonical 4 tiers and 7 hard-stop categories", () => {
    expect(RISK_TIERS).toEqual(["low", "medium", "high", "critical"]);
    expect(HARD_STOP_CATEGORIES).toHaveLength(7);
    expect(HARD_STOP_CATEGORIES).toContain("financial");
    expect(HARD_STOP_CATEGORIES).toContain("security");
    expect(HARD_STOP_CATEGORIES).toContain("privacy");
    expect(HARD_STOP_CATEGORIES).toContain("data_loss");
    expect(HARD_STOP_CATEGORIES).toContain("infrastructure");
    expect(HARD_STOP_CATEGORIES).toContain("project_break");
    expect(HARD_STOP_CATEGORIES).toContain("legal");
  });

  it("store_event is low risk and auto-applies", () => {
    const v = classifyAt({ type: "store_event" });
    expect(v.tier).toBe("low");
    expect(v.autoApply).toBe(true);
    expect(v.hardStops).toEqual([]);
  });

  it("modify_financial is critical (hard-stop)", () => {
    const v = classifyAt({ type: "modify_financial", scope: "stripe" });
    expect(v.tier).toBe("critical");
    expect(v.autoApply).toBe(false);
    expect(v.hardStops).toContain("financial");
  });

  it("modify_auth is critical (hard-stop security)", () => {
    const v = classifyAt({ type: "modify_auth", scope: "github_oauth" });
    expect(v.tier).toBe("critical");
    expect(v.hardStops).toContain("security");
  });

  it("delete_data is critical (hard-stop data_loss)", () => {
    const v = classifyAt({ type: "delete_data", path: "/etc/passwd" });
    expect(v.tier).toBe("critical");
    expect(v.hardStops).toContain("data_loss");
  });

  it("modify_infrastructure is critical", () => {
    const v = classifyAt({ type: "modify_infrastructure", scope: "k8s" });
    expect(v.tier).toBe("critical");
    expect(v.hardStops).toContain("infrastructure");
  });

  it("modify_unowned_file is critical (project_break)", () => {
    const v = classifyAt({ type: "modify_unowned_file", path: "/home/user/random.txt" });
    expect(v.tier).toBe("critical");
    expect(v.hardStops).toContain("project_break");
  });

  it("network_request to https is critical (privacy)", () => {
    const v = classifyAt({ type: "network_request", url: "https://example.com/x", method: "GET" });
    expect(v.tier).toBe("critical");
    expect(v.hardStops).toContain("privacy");
  });

  it("network_request to localhost is low risk", () => {
    const v = classifyAt({ type: "network_request", url: "http://localhost:3000/x", method: "GET" });
    expect(v.tier).toBe("low");
    expect(v.hardStops).toEqual([]);
  });

  it("modify_owned_file is medium by default", () => {
    const v = classifyAt({ type: "modify_owned_file", path: "packages/core/src/x.ts" });
    expect(v.tier).toBe("medium");
    expect(v.autoApply).toBe(true);
    expect(v.requiresApproval).toBe(false);
  });

  it("spawn_subprocess with rm -rf is high", () => {
    const v = classifyAt({ type: "spawn_subprocess", command: "rm -rf /" });
    expect(v.tier).toBe("high");
  });

  it("spawn_subprocess with ls is medium", () => {
    const v = classifyAt({ type: "spawn_subprocess", command: "ls -la" });
    expect(v.tier).toBe("medium");
  });

  it("respects allow_high=false: high-risk becomes requiresApproval=true", () => {
    const config = { ...DEFAULT_CONFIG, autonomy: { ...DEFAULT_CONFIG.autonomy, allow_high: false } };
    const v = classifyAt({ type: "spawn_subprocess", command: "rm -rf /tmp/foo" }, config);
    expect(v.tier).toBe("high");
    expect(v.requiresApproval).toBe(true);
    expect(v.autoApply).toBe(false);
  });

  it("respects allow_high=true: high-risk auto-applies", () => {
    const config = { ...DEFAULT_CONFIG, autonomy: { ...DEFAULT_CONFIG.autonomy, allow_high: true } };
    const v = classifyAt({ type: "spawn_subprocess", command: "rm -rf /tmp/foo" }, config);
    expect(v.tier).toBe("high");
    expect(v.autoApply).toBe(true);
    expect(v.requiresApproval).toBe(false);
  });
});
