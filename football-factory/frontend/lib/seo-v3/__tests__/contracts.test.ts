// Football Factory — SEO V3 contracts tests (Wave A).

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSeoDomainAdapter, type SeoDomainAdapter } from "../contracts";

class StubAdapter implements SeoDomainAdapter {
  async resolveEntity() {
    return [];
  }
  async getEntityRelations() {
    return [];
  }
  getLandingPageType() {
    return "stub";
  }
  getIntentRules() {
    return [];
  }
  getSchemaExtensions() {
    return [];
  }
  async getInternalLinkTargets() {
    return [];
  }
}

test("contracts: stub passes the contract", () => {
  assert.equal(assertSeoDomainAdapter(new StubAdapter()), true);
});

test("contracts: missing method throws", () => {
  class Bad implements Partial<SeoDomainAdapter> {
    async resolveEntity() {
      return [];
    }
    // intentionally missing the other 5 methods
  }
  assert.throws(() => assertSeoDomainAdapter(new Bad()), /Missing adapter method/);
});

test("contracts: non-object throws", () => {
  assert.throws(() => assertSeoDomainAdapter(null), /not an object/);
  assert.throws(() => assertSeoDomainAdapter(42), /not an object/);
});

test("contracts: missing multiple methods lists all of them", () => {
  class VeryBad {}
  assert.throws(
    () => assertSeoDomainAdapter(new VeryBad()),
    /resolveEntity/,
  );
});
