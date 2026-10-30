function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** One-line summary of what a focus session will block, e.g. "6 sites · 3 keywords · 1 schedule". */
export function blockScopeSummary(
  sites: number,
  keywords: number,
  schedules: number,
): string {
  return [
    countLabel(sites, "site", "sites"),
    countLabel(keywords, "keyword", "keywords"),
    countLabel(schedules, "schedule", "schedules"),
  ].join(" · ");
}
