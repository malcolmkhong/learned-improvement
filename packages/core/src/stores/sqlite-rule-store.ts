/**
 * SQLite implementation of RuleStore.
 */

import type { Database, Statement } from "better-sqlite3";
import { RuleSchema, type Rule, type RuleStatus } from "../models/rule.js";
import type { RuleStore } from "../ports/storage.js";

interface RuleRow {
  id: string;
  condition_json: string;
  action: string;
  priority: number;
  status: string;
  rationale: string;
  lesson_id: string | null;
  created_at: string;
  activated_at: string | null;
  archived_at: string | null;
  violation_count: number;
}

export class SqliteRuleStore implements RuleStore {
  private readonly upsertStmt: Statement;
  private readonly getStmt: Statement<[string], RuleRow>;
  private readonly listAllStmt: Statement<[number], RuleRow>;
  private readonly listByStatusStmt: Statement<[string, number], RuleRow>;
  private readonly setStatusStmt: Statement<[string, string | null, string | null, string]>;
  private readonly activeStmt: Statement<[], RuleRow>;

  constructor(private readonly db: Database) {
    this.upsertStmt = db.prepare(`
      INSERT INTO rules (id, condition_json, action, priority, status, rationale, lesson_id,
                         created_at, activated_at, archived_at, violation_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        condition_json = excluded.condition_json,
        action = excluded.action,
        priority = excluded.priority,
        status = excluded.status,
        rationale = excluded.rationale,
        lesson_id = excluded.lesson_id,
        activated_at = excluded.activated_at,
        archived_at = excluded.archived_at,
        violation_count = excluded.violation_count
    `);
    this.getStmt = db.prepare(`SELECT * FROM rules WHERE id = ?`);
    this.listAllStmt = db.prepare(`SELECT * FROM rules ORDER BY created_at DESC LIMIT ?`);
    this.listByStatusStmt = db.prepare(`SELECT * FROM rules WHERE status = ? ORDER BY created_at DESC LIMIT ?`);
    this.setStatusStmt = db.prepare(`UPDATE rules SET status = ?, activated_at = COALESCE(?, activated_at), archived_at = COALESCE(?, archived_at) WHERE id = ?`);
    this.activeStmt = db.prepare(`SELECT * FROM rules WHERE status = 'active' ORDER BY priority DESC, created_at DESC`);
  }

  upsert(rule: Rule): Rule {
    this.upsertStmt.run(
      rule.id,
      JSON.stringify(rule.condition),
      rule.action,
      rule.priority,
      rule.status,
      rule.rationale,
      rule.lesson_id,
      rule.created_at,
      rule.activated_at,
      rule.archived_at,
      rule.violation_count,
    );
    return rule;
  }

  get(id: string): Rule | null {
    const row = this.getStmt.get(id) as RuleRow | undefined;
    return row === undefined ? null : this.toRule(row);
  }

  list(options: { status?: RuleStatus; limit?: number } = {}): readonly Rule[] {
    const limit = options.limit ?? 1000;
    const rows = (
      options.status !== undefined
        ? (this.listByStatusStmt.all(options.status, limit) as RuleRow[])
        : (this.listAllStmt.all(limit) as RuleRow[])
    );
    return rows.map((r) => this.toRule(r));
  }

  setStatus(id: string, status: RuleStatus, when?: string): Rule | null {
    const existing = this.get(id);
    if (existing === null) return null;
    const timestamp = when ?? new Date().toISOString();
    if (status === "active") {
      this.setStatusStmt.run(status, timestamp, null, id);
    } else if (status === "archived" || status === "disabled") {
      this.setStatusStmt.run(status, null, timestamp, id);
    } else {
      this.setStatusStmt.run(status, null, null, id);
    }
    return this.get(id);
  }

  activeRules(): readonly Rule[] {
    const rows = this.activeStmt.all() as RuleRow[];
    return rows.map((r) => this.toRule(r));
  }

  private toRule(row: RuleRow): Rule {
    const parsed = RuleSchema.safeParse({
      id: row.id,
      condition: JSON.parse(row.condition_json),
      action: row.action,
      priority: row.priority,
      status: row.status,
      rationale: row.rationale,
      lesson_id: row.lesson_id,
      created_at: row.created_at,
      activated_at: row.activated_at,
      archived_at: row.archived_at,
      violation_count: row.violation_count,
    });
    if (!parsed.success) {
      throw new Error(`Corrupt rule row id=${row.id}: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}
