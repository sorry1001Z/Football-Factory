export type RightsEvidence = Record<string, unknown>;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Images require an explicit human rights decision and auditable provenance. */
export function canUploadEditorialImage(input: {
  rightsConfirmed: boolean;
  rights: RightsEvidence | null | undefined;
}): boolean {
  const rights = input.rights;
  if (!input.rightsConfirmed || !rights || rights.state !== "cleared") return false;
  const source = rights.source_url;
  const license = rights.license_name ?? rights.license;
  const attribution = rights.attribution_text ?? rights.attribution;
  const permission = rights.permission_evidence ?? rights.notes;
  return isHttpUrl(source) &&
    (nonEmpty(rights.author) || nonEmpty(rights.source_name)) &&
    nonEmpty(license) &&
    isHttpUrl(rights.license_url) &&
    nonEmpty(attribution) &&
    (rights.commercial_use_confirmed === true || nonEmpty(permission));
}
