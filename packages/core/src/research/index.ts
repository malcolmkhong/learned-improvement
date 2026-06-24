/**
 * Research — opt-in web fetcher for fact verification and freshness.
 *
 * V1 implementation: a single async function that fetches a URL and
 * returns the text. No caching, no indexing. Future versions will add
 * semantic dedup, freshness scoring, and source reputation.
 *
 * Hard rule: research NEVER auto-executes when `config.research.enabled`
 * is false. The Risk Classifier already enforces this at the action
 * level, but we double-check here for defense in depth.
 */

import type { Config } from "../config.js";

export interface FetchResult {
  readonly url: string;
  readonly ok: boolean;
  readonly status: number;
  readonly text: string;
  readonly fetchedAt: string;
}

export interface ResearchOptions {
  readonly timeoutMs?: number;
}

export class ResearchClient {
  constructor(private readonly config: Config) {}

  async fetch(url: string, options: ResearchOptions = {}): Promise<FetchResult> {
    if (!this.config.research.enabled) {
      throw new Error("Research is disabled (set [research] enabled = true in ~/.ci/config.toml)");
    }
    const timeoutMs = options.timeoutMs ?? 15_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const text = await res.text();
      return {
        url,
        ok: res.ok,
        status: res.status,
        text,
        fetchedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** True if a fact is older than the configured max age. */
  isStale(fetchedAt: string): boolean {
    const maxAgeMs = this.config.research.max_age_months * 30 * 24 * 60 * 60 * 1000;
    const fetchedMs = Date.parse(fetchedAt);
    if (Number.isNaN(fetchedMs)) return true;
    return Date.now() - fetchedMs > maxAgeMs;
  }
}
