/**
 * Daemon — the long-running scheduler. For V1 we provide a single
 * `runOnce()` method that executes one Observe -> Apply cycle and returns
 * the report. A true `start()` that loops forever lives in the CLI binary.
 */

import { mkdirSync } from "node:fs";
import type { LoopDeps } from "./loop/index.js";
import { AutonomousLoop, type LoopReport } from "./loop/index.js";

export interface DaemonRunOptions {
  readonly now?: () => Date;
}

/** Filesystem layout the daemon requires inside its home directory. */
const REQUIRED_SUBDIRS = ["snapshots", "logs"] as const;

export class Daemon {
  constructor(private readonly deps: LoopDeps) {}

  /** Ensure the home directory and its sub-directories exist. Idempotent. */
  static ensureHome(homeDir: string): void {
    mkdirSync(homeDir, { recursive: true });
    for (const sub of REQUIRED_SUBDIRS) {
      mkdirSync(`${homeDir}/${sub}`, { recursive: true });
    }
  }

  async runOnce(options: DaemonRunOptions = {}): Promise<LoopReport> {
    const loop = new AutonomousLoop(this.deps, options);
    return loop.runCycle();
  }
}
