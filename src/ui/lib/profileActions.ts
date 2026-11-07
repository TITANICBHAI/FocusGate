import { cleanDisplayName, cleanWhy } from "../../shared/profile.ts";
import type { Settings } from "../../shared/types.ts";
import type { StorageStore } from "../hooks/storageStore.ts";
import { uiStorageStore } from "../hooks/storageStore.ts";

export type ProfileField = "displayName" | "why";

/** Pure update: set one profile field, cleaned, and leave every other setting alone. */
export function applyProfileField(
  settings: Settings,
  field: ProfileField,
  value: string,
): Settings {
  return {
    ...settings,
    displayName: field === "displayName" ? cleanDisplayName(value) : cleanDisplayName(settings.displayName),
    why: field === "why" ? cleanWhy(value) : cleanWhy(settings.why),
  };
}

/** Saves one profile field through the store's guarded settings write. */
export async function saveProfileField(
  store: StorageStore,
  field: ProfileField,
  value: string,
): Promise<void> {
  await store.set("settings", (latest) => applyProfileField(latest, field, value));
}

export function saveProfileFieldDefault(field: ProfileField, value: string): Promise<void> {
  return saveProfileField(uiStorageStore, field, value);
}
