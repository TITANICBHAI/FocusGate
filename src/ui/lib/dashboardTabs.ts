export type DashboardTab =
  | "overview"
  | "rules"
  | "blocknow"
  | "reports"
  | "settings"
  | "data";

export const DASHBOARD_TABS: { value: DashboardTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "rules", label: "Rules" },
  { value: "blocknow", label: "Block now" },
  { value: "reports", label: "Reports" },
  { value: "settings", label: "Settings" },
  { value: "data", label: "Data" },
];

/** The tab an address points to ("#settings" or "settings"), or null. */
export function tabFromHash(hash: string): DashboardTab | null {
  const name = hash.replace("#", "");
  return DASHBOARD_TABS.find((tab) => tab.value === name)?.value ?? null;
}
