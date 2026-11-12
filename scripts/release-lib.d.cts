export const BROWSERS: string[];
export const RELEASE_ASSETS: string[];
export function extractReleaseNotes(changelog: string, version: string): string;
export function findBrowserZips(dir: string): Record<"chrome" | "edge" | "firefox", string>;
export function manifestProblems(manifest: Record<string, unknown>, browser: string, version: string): string[];
export function readZipManifest(zipPath: string): Record<string, unknown>;
