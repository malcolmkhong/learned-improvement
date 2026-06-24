/**
 * SQLite implementation of FactStore.
 */

import type { Database, Statement } from "better-sqlite3";
import { FactSchema, type Fact, type FactCategory } from "../models/fact.js";
import type { FactStore } from "../ports/storage.js";

interface FactRow {
  id: number;
  key: string;
  category: string;
  value: string;
  source: string;
  source_url: string | null;
  fetched_at: string;
  verified_at: string | null;
  confidence: number;
}

export class SqliteFactStore implements FactStore {
  private readonly upsertStmt: Statement;
  private readonly getStmt: Statement<[string], FactRow>;
  private readonly listAllStmt: Statement<[number], FactRow>;
  private readonly listByCategoryStmt: Statement<[string, number], FactRow>;

  constructor(private readonly db: Database) {
    this.upsertStmt = db.prepare(`
      INSERT INTO facts (key, category, value, source, source_url, fetched_at, verified_at, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        category = excluded.category,
        value = excluded.value,
        source = excluded.source,
        source_url = excluded.source_url,
        fetched_at = excluded.fetched_at,
        verified_at = excluded.verified_at,
        confidence = excluded.confidence
    `);
    this.getStmt = db.prepare(`SELECT * FROM facts WHERE key = ?`);
    this.listAllStmt = db.prepare(`SELECT * FROM facts ORDER BY fetched_at DESC LIMIT ?`);
    this.listByCategoryStmt = db.prepare(`SELECT * FROM facts WHERE category = ? ORDER BY fetched_at DESC LIMIT ?`);
  }

  put(input: {
    key: string;
    category: FactCategory;
    value: Record<string, unknown>;
    source: string;
    source_url?: string | null;
    confidence: number;
  }): Fact {
    const fetched_at = new Date().toISOString();
    this.upsertStmt.run(
      input.key,
      input.category,
      JSON.stringify(input.value),
      input.source,
      input.source_url ?? null,
      fetched_at,
      null,
      input.confidence,
    );
    const fact = this.get(input.key);
    if (fact === null) {
      throw new Error(`Failed to read back fact after upsert: key=${input.key}`);
    }
    return fact;
  }

  get(key: string): Fact | null {
    const row = this.getStmt.get(key) as FactRow | undefined;
    return row === undefined ? null : this.toFact(row);
  }

  list(options: { category?: FactCategory; limit?: number } = {}): readonly Fact[] {
    const limit = options.limit ?? 1000;
    const rows = (
      options.category !== undefined
        ? (this.listByCategoryStmt.all(options.category, limit) as FactRow[])
        : (this.listAllStmt.all(limit) as FactRow[])
    );
    return rows.map((r) => this.toFact(r));
  }

  private toFact(row: FactRow): Fact {
    const parsed = FactSchema.safeParse({
      id: row.id,
      key: row.key,
      category: row.category,
      value: JSON.parse(row.value) as Record<string, unknown>,
      source: row.source,
      source_url: row.source_url,
      fetched_at: row.fetched_at,
      verified_at: row.verified_at,
      confidence: row.confidence,
    });
    if (!parsed.success) {
      throw new Error(`Corrupt fact row key=${row.key}: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}
