/**
 * Snapshots — periodic copies of state.db so we can rollback.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export interface SnapshotInfo {
  readonly name: string;
  readonly path: string;
  readonly createdAt: string;
  readonly sizeBytes: number;
}

export class SnapshotManager {
  constructor(
    private readonly snapshotDir: string,
    private readonly maxSnapshots: number = 14,
  ) {}

  ensureDir(): void {
    mkdirSync(this.snapshotDir, { recursive: true });
  }

  create(dbPath: string): SnapshotInfo {
    this.ensureDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = join(this.snapshotDir, `state-${stamp}.db`);
    copyFileSync(dbPath, dest);
    const stat = statSync(dest);
    this.prune();
    return { name: `state-${stamp}.db`, path: dest, createdAt: new Date().toISOString(), sizeBytes: stat.size };
  }

  list(): readonly SnapshotInfo[] {
    if (!existsSync(this.snapshotDir)) return [];
    const files = readdirSync(this.snapshotDir)
      .filter((f) => f.endsWith(".db"))
      .sort()
      .reverse();
    return files.map((name) => {
      const path = join(this.snapshotDir, name);
      const stat = statSync(path);
      return { name, path, createdAt: stat.mtime.toISOString(), sizeBytes: stat.size };
    });
  }

  restore(snapshotName: string, dbPath: string): void {
    const path = join(this.snapshotDir, snapshotName);
    if (!existsSync(path)) throw new Error(`Snapshot not found: ${snapshotName}`);
    copyFileSync(path, dbPath);
  }

  private prune(): void {
    const all = this.list();
    const toDelete = all.slice(this.maxSnapshots);
    for (const snap of toDelete) {
      try {
        unlinkSync(snap.path);
      } catch {
        // ignore
      }
    }
  }
}
