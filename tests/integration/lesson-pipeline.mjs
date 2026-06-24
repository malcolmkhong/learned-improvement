/**
 * Integration smoke test — emits 3 TEST_FAILED events with the same
 * error_type, then runs LessonEngine.runCycle() and asserts a lesson
 * was derived.
 *
 * Run with: CI_HOME=/tmp/ci-integration node tests/integration/lesson-pipeline.mjs
 * (or just `node tests/integration/lesson-pipeline.mjs` for default ~/.ci).
 */

import { strict as assert } from "node:assert";
import { openDatabase, SqliteEventStore, SqliteLessonStore, LessonEngine, ConfigManager, resolvePaths } from "../../packages/core/dist/index.js";

const paths = resolvePaths();
const db = openDatabase({ path: paths.db });
const events = new SqliteEventStore(db);
const lessons = new SqliteLessonStore(db);
const config = new ConfigManager(paths.config);
const engine = new LessonEngine(lessons, events, config.get());

const ERROR = "TEST_FAILED: forgot to await async function";

// Emit 3 events with the same error_type — should trigger a lesson.
for (let i = 0; i < 3; i++) {
  events.append({
    type: "TEST_FAILED",
    severity: "warn",
    error_type: ERROR,
    source: "integration-test",
    payload: { test: `test_${i}` },
    trace_id: `trace_${i}`,
  });
}

const out = engine.runCycle();

assert.equal(out.length, 1, `expected 1 lesson, got ${out.length}`);
const lesson = out[0];
assert.ok(lesson !== undefined);
assert.equal(lesson.pattern, ERROR, `pattern mismatch: got "${lesson.pattern}"`);
assert.equal(lesson.status, "candidate", `status mismatch: got ${lesson.status}`);
assert.equal(lesson.occurrences, 3, `occurrences mismatch: got ${lesson.occurrences}`);
assert.equal(lesson.source_event_ids.length, 3, "should reference 3 source events");

console.log("✔ Integration test passed:");
console.log(`  pattern:     ${lesson.pattern}`);
console.log(`  status:      ${lesson.status}`);
console.log(`  confidence:  ${lesson.confidence}`);
console.log(`  occurrences: ${lesson.occurrences}`);
console.log(`  source IDs:  ${lesson.source_event_ids.join(", ")}`);

db.close();