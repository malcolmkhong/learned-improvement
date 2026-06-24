/**
 * Resolves the daemon's filesystem layout (`~/.ci/`).
 * All paths used by the daemon must go through this module.
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface CiPaths {
  readonly home: string;
  readonly db: string;
  readonly config: string;
  readonly profile: string;
  readonly logDir: string;
  readonly logFile: string;
  readonly snapshotDir: string;
  readonly agentsMd: string;
  readonly quickrefMd: string;
  readonly pidFile: string;
}

export interface CiPathsOptions {
  home?: string;
}

export function resolvePaths(options: CiPathsOptions = {}): CiPaths {
  const home = resolve(options.home ?? process.env["CI_HOME"] ?? join(homedir(), ".ci"));
  return {
    home,
    db: join(home, "state.db"),
    config: join(home, "config.toml"),
    profile: join(home, "project_profile.json"),
    logDir: join(home, "logs"),
    logFile: join(home, "logs", "ci.log"),
    snapshotDir: join(home, "snapshots"),
    agentsMd: join(home, "AGENTS.md"),
    quickrefMd: join(home, "QUICKREF.md"),
    pidFile: join(home, "ci.pid"),
  };
}
