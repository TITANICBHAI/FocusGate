import type { AppState } from "../../shared/types.ts";
import type { RuleSection } from "../panel/views/RulesScreen.tsx";
import { scheduleStatus } from "./scheduleStatus.ts";
import { statusLine } from "./scheduleSummary.ts";

export interface ProtectionRow {
  id: "focus" | "always" | "keywords" | "schedules" | "limits" | "password";
  label: string;
  value: string;
  /** The Rules section this row opens; null when there is nothing to open. */
  section: RuleSection | null;
}

/** First letter of the name as one whole character, upper-cased; null if empty. */
export function badgeInitial(name: string): string | null {
  const first = Array.from(name.trim())[0];
  return first === undefined ? null : first.toLocaleUpperCase();
}

function count(total: number, one: string, many: string): string {
  if (total === 0) return "None";
  return `${total} ${total === 1 ? one : many}`;
}

/** The "What you're protecting" rows, in the pinned order and wording. */
export function protectionRows(state: AppState, now: number): ProtectionRow[] {
  return [
    {
      id: "focus",
      label: "Focus list",
      value: count(state.blockedSites.length, "site", "sites"),
      section: "sites",
    },
    {
      id: "always",
      label: "Always list",
      value: count(state.alwaysBlockedSites.length, "site", "sites"),
      section: "sites",
    },
    {
      id: "keywords",
      label: "Keywords",
      value: count(state.keywords.length, "keyword", "keywords"),
      section: "keywords",
    },
    {
      id: "schedules",
      label: "Schedules",
      value: statusLine(scheduleStatus(state.schedules, now), now),
      section: "schedule",
    },
    {
      id: "limits",
      label: "Daily limits",
      value: count(Object.keys(state.allowances).length, "limit", "limits"),
      section: "limits",
    },
    {
      id: "password",
      label: "Password",
      value: state.password === null ? "Not set" : "Set",
      section: null,
    },
  ];
}

/** Screen-reader name for a row: label and value, plus where it goes. */
export function rowAccessibleName(row: ProtectionRow): string {
  const base = `${row.label}, ${row.value.replace(/\.$/, "")}.`;
  return row.section === null ? base : `${base} Open in Rules.`;
}
