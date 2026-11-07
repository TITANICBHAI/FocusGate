/** The version from the manifest, or "" when it cannot be read (for example in a test). */
export function appVersion(): string {
  try {
    return chrome.runtime.getManifest().version ?? "";
  } catch {
    return "";
  }
}

export function AboutLine({ version = appVersion() }: { version?: string }) {
  return (
    <>
      <p>{version ? `FocusGate v${version} by TBTechs` : "FocusGate by TBTechs"}</p>
      <p className="fg-muted">Your data stays in browser storage.</p>
    </>
  );
}
