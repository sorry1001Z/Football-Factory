// Football Factory — WordPress write client test hooks.
//
// Lets route tests inject a fake WordPressWriteClient without standing
// up a real WordPress instance. The route module imports the
// `getWordPressWriteClient` factory from here (default: real class).
//
// The factory is globalThis-scoped so module identity is preserved
// across the test runtime.

import "server-only";
import { WordPressWriteClient } from "@/lib/wordpress/write";

export type WordPressWriteClientLike = Pick<
  WordPressWriteClient,
  "configured" | "createPost" | "updatePost" | "trashPost"
>;

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
