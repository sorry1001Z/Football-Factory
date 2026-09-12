// Football Factory — consent version constant.
//
// All persisted consent snapshots MUST carry this version. If a future
// consent policy breaks backwards-compatibility, bump CONSENT_VERSION
// and refuse to load incompatible snapshots (returning null instead of
// silently accepting them).

export const CONSENT_VERSION = 1 as const;
export type ConsentVersion = typeof CONSENT_VERSION;
