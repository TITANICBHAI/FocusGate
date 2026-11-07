import type { Settings } from "./types.ts";

export const DISPLAY_NAME_MAX = 24;
export const WHY_MAX = 140;

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max).trim() : "";
}

/** A display name: trimmed and at most 24 characters. Anything else is empty. */
export function cleanDisplayName(value: unknown): string {
  return cleanText(value, DISPLAY_NAME_MAX);
}

/** The person's reason: trimmed and at most 140 characters. Anything else is empty. */
export function cleanWhy(value: unknown): string {
  return cleanText(value, WHY_MAX);
}

/**
 * Settings stored before the profile fields existed lack them. This fills
 * both fields and cuts over-long values, leaving every other setting as is.
 */
export function withProfileDefaults(settings: Settings): Settings {
  return {
    ...settings,
    displayName: cleanDisplayName(settings.displayName),
    why: cleanWhy(settings.why),
  };
}
