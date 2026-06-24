/**
 * Risk classifier integration test — exercises the full autonomy contract:
 * store_event is low (auto), modify_owned_file is medium (auto+report),
 * modify_financial is critical (block), and the config override
 * `allow_high = true` flips a high-risk verdict to auto-apply.
 *
 * Run with: node tests/integration/risk-classifier.mjs
 */

import { strict as assert } from "node:assert";
import { classify, DEFAULT_CONFIG } from "../../packages/core/dist/index.js";

function proposalFor(kind) {
  return { id: `p_${kind.type}`, kind, rationale: "test", sourceRuleId: null, sourceLessonId: null };
}

const cfg = DEFAULT_CONFIG;

// Low tier — store_event
const low = classify(proposalFor({ type: "store_event" }), cfg);
assert.equal(low.tier, "low", `store_event tier: ${low.tier}`);
assert.equal(low.autoApply, true);
assert.equal(low.hardStops.length, 0);

// Medium tier — modify_owned_file
const med = classify(proposalFor({ type: "modify_owned_file", path: "packages/core/src/x.ts" }), cfg);
assert.equal(med.tier, "medium", `modify_owned_file tier: ${med.tier}`);
assert.equal(med.autoApply, true);

// Critical tier — modify_financial
const crit = classify(proposalFor({ type: "modify_financial", scope: "stripe" }), cfg);
assert.equal(crit.tier, "critical", `modify_financial tier: ${crit.tier}`);
assert.equal(crit.hardStops[0], "financial");

// Critical tier — delete_data
const del = classify(proposalFor({ type: "delete_data", path: "/etc/passwd" }), cfg);
assert.equal(del.tier, "critical");
assert.equal(del.hardStops[0], "data_loss");

// Critical tier — external network request (privacy)
const ext = classify(proposalFor({ type: "network_request", url: "https://example.com/x", method: "GET" }), cfg);
assert.equal(ext.tier, "critical");
assert.equal(ext.hardStops[0], "privacy");

// Loopback network request is low
const loop = classify(proposalFor({ type: "network_request", url: "http://localhost:3000/x", method: "GET" }), cfg);
assert.equal(loop.tier, "low", `localhost tier: ${loop.tier}`);
assert.equal(loop.hardStops.length, 0);

// allow_high=true flips a high-risk verdict
const allowHigh = {
  ...cfg,
  autonomy: { ...cfg.autonomy, allow_high: true },
};
const highWithOverride = classify(
  proposalFor({ type: "spawn_subprocess", command: "rm -rf /tmp/foo" }),
  allowHigh,
);
assert.equal(highWithOverride.tier, "high");
assert.equal(highWithOverride.autoApply, true, "allow_high=true should auto-apply high-tier");

// allow_high=false keeps it blocked
const blockHigh = classify(
  proposalFor({ type: "spawn_subprocess", command: "rm -rf /tmp/foo" }),
  cfg,
);
assert.equal(blockHigh.autoApply, false, "allow_high=false should block high-tier");

console.log("✔ Risk classifier integration test passed (7 scenarios verified).");