// Football Factory — WordPress write client test hooks.
//
// Lets route tests inject a fake WordPressWriteClient without standing
// up a real WordPress instance. The route module imports the
// `getWordPressWriteClient` factory from here (default: real class).
//
// The factory is globalThis-scoped so module identity is preserved
// across the test runtime.

import "server-only";
import { WordPressWriteClient, type WpMedia } from "@/lib/wordpress/write";

export type WordPressWriteClientLike = Pick<
  WordPressWriteClient,
  "configured" | "createPost" | "updatePost" | "trashPost"
> & {
  // uploadMedia is optional in the factory contract because most
  // existing call sites (wp-publish, wp-draft, safety-patch tests)
  // never upload media. Routes that need it (e.g. /api/automation/media)
  // type-check against the real WordPressWriteClient, not this mockable
  // interface.
  uploadMedia?: WordPressWriteClient["uploadMedia"];
};

// Re-export WpMedia so tests can construct typed return values without
// importing the (server-only) write module directly.
export type { WpMedia };

declare global {
  // eslint-disable-next-line no-var
  var __FF_WP_WRITE_CLIENT_FACTORY__: (() => WordPressWriteClientLike) | undefined;
}

/**
 * Route layer helper. Returns either a test-injected fake or a real
 * WordPressWriteClient instance.
 */
export function getWordPressWriteClient(): WordPressWriteClientLike {
  const f = globalThis.__FF_WP_WRITE_CLIENT_FACTORY__;
  if (f) return f();
  return new WordPressWriteClient();
}

export function setWordPressWriteClientFactoryForTest(
  factory: () => WordPressWriteClientLike,
): void {
  globalThis.__FF_WP_WRITE_CLIENT_FACTORY__ = factory;
}

export function resetWordPressWriteClientFactoryForTest(): void {
  globalThis.__FF_WP_WRITE_CLIENT_FACTORY__ = undefined;
}
