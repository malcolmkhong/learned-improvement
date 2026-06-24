/**
 * ProjectProfile — output of the scanner; describes a project in
 * machine-readable form so the daemon can ground its reasoning.
 */

import { z } from "zod";

export const FOLDER_SCHEMA = z.object({
  path: z.string(),
  purpose: z.string().optional(),
});

export const ADR_SCHEMA = z.object({
  path: z.string(),
  title: z.string(),
  decision: z.string(),
});

export const DEPENDENCY_SCHEMA = z.object({
  name: z.string(),
  version: z.string(),
  source: z.enum(["npm", "pypi", "go", "cargo", "rubygems", "other"]),
});

export const LINT_CONFIG_SCHEMA = z.object({
  tool: z.string(),
  config_path: z.string(),
});

export const ProjectProfileSchema = z.object({
  version: z.literal(1),
  repo_root: z.string(),
  language: z.enum(["typescript", "javascript", "python", "mixed", "unknown"]),
  package_manager: z.enum(["npm", "pnpm", "yarn", "pip", "poetry", "uv", "none", "unknown"]),
  scanned_at: z.string(),
  folders: z.array(FOLDER_SCHEMA),
  adrs: z.array(ADR_SCHEMA),
  naming_conventions: z.array(z.string()),
  dependencies: z.array(DEPENDENCY_SCHEMA),
  lint_configs: z.array(LINT_CONFIG_SCHEMA),
});

export type ProjectProfileInput = z.input<typeof ProjectProfileSchema>;
export type ProjectProfile = z.output<typeof ProjectProfileSchema>;
export type Adr = z.output<typeof ADR_SCHEMA>;
export type Dependency = z.output<typeof DEPENDENCY_SCHEMA>;
export type LintConfig = z.output<typeof LINT_CONFIG_SCHEMA>;
export type Folder = z.output<typeof FOLDER_SCHEMA>;
