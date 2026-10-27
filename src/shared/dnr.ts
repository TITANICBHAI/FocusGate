import { escapeRegex } from "./domains.ts";
import type { BlockPlan } from "./plan.ts";

export interface SkippedDnrEntry {
  entry: string;
  reason: string;
}

export interface DnrBuildResult {
  rules: chrome.declarativeNetRequest.Rule[];
  skipped: SkippedDnrEntry[];
}

const MAX_EXCEPTION_RULES = 200;

export function buildDnrRules(
  plan: BlockPlan,
  blockedBase: string,
): DnrBuildResult {
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  const skipped: SkippedDnrEntry[] = [];
  const isAscii = (entry: string) => /^[\x00-\x7f]+$/.test(entry);
  const redirectTarget = `${blockedBase}#\\1`;
  const domains = [...plan.blocked.keys()].filter((domain) => {
    if (isAscii(domain)) return true;
    skipped.push({ entry: domain, reason: "non-ascii" });
    return false;
  });

  if (domains.length > 0) {
    rules.push({
      id: 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { regexSubstitution: redirectTarget },
      },
      condition: {
        requestDomains: domains,
        regexFilter: "^(https?://.+)$",
        resourceTypes: ["main_frame"],
      },
    });
  }

  const allowed = (plan.allowOnly ?? []).filter((domain) => {
    if (isAscii(domain)) return true;
    skipped.push({ entry: domain, reason: "non-ascii" });
    return false;
  });
  if (allowed.length > 0) {
    rules.push({
      id: 2,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { regexSubstitution: redirectTarget },
      },
      condition: {
        excludedRequestDomains: allowed,
        regexFilter: "^(https?://.+)$",
        resourceTypes: ["main_frame"],
      },
    });
  }

  for (const [index, raw] of plan.exceptions.entries()) {
    if (index >= MAX_EXCEPTION_RULES) {
      skipped.push({ entry: raw, reason: "rule-limit" });
      continue;
    }
    if (!isAscii(raw)) {
      skipped.push({ entry: raw, reason: "non-ascii" });
      continue;
    }
    rules.push({
      id: 100 + index,
      priority: 2,
      action: { type: "allow" },
      condition: {
        regexFilter: `^https?://(www\\.)?${escapeRegex(raw)}([/?&#]|$)`,
        resourceTypes: ["main_frame"],
      },
    });
  }

  return { rules, skipped };
}
