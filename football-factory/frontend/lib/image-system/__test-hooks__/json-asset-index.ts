// TEST-ONLY in-memory AssetIndex.
//
// Adapted from the external Football Image System R2 pack
// (src/index.ts). The R2 pack made this the default index; for our
// integration we deliberately keep it in __test-hooks__/ so production
// callers must implement a persistent AssetIndex backed by a database
// (deferred to a later slice — this is metadata storage, NOT a DB
// migration).
//
// Tests import this through `@/lib/image-system/__test-hooks__/json-asset-index`
// or via a test-only import alias. Production code should NEVER import
// from this path.

import type { Asset } from "../types";
import type { AssetIndex } from "../prefetch";

export class JsonAssetIndex implements AssetIndex {
  constructor(public items: Asset[] = []) {}

  async upsert(a: Asset): Promise<void> {
    const i = this.items.findIndex(
      (x) => x.asset_id === a.asset_id || x.canonical_source_url === a.canonical_source_url,
    );
    if (i >= 0) this.items[i] = a;
    else this.items.push(a);
  }

  async get(id: string): Promise<Asset | undefined> {
    return this.items.find((x) => x.asset_id === id);
  }

  async byCanonical(u: string): Promise<Asset | undefined> {
    return this.items.find((x) => x.canonical_source_url === u);
  }

  async find(q: {
    player?: string;
    team?: string;
    competition?: string;
    tags?: string[];
  }): Promise<Asset[]> {
    return this.items.filter(
      (x) =>
        (!q.player || x.player === q.player) &&
        (!q.team || x.team === q.team) &&
        (!q.competition || x.competition === q.competition) &&
        (!q.tags || q.tags.every((t: string) => x.tags.includes(t))),
    );
  }

  async quarantine(id: string, reason: "license" | "source"): Promise<void> {
    const a = await this.get(id);
    if (a) a.state = reason === "license" ? "QUARANTINED_LICENSE" : "QUARANTINED_SOURCE";
  }
}
