/** A manifest as a plain object. The generator reads and writes only what it names. */
export type ManifestObject = Record<string, unknown>;

export function toFirefoxManifest(manifest: ManifestObject): ManifestObject;
