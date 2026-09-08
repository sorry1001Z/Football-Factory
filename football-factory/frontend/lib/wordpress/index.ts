// Football Factory — WordPress module barrel.

export type {
  WordPressAuthor,
  WordPressCategory,
  WordPressContentOrigin,
  WordPressContentSource,
  WordPressMedia,
  WordPressPost,
  WordPressProvider,
  WordPressSeo,
  WordPressTag,
} from "./types";

export {
  WordPressClient,
  WordPressClientError,
  type WordPressClientErrorKind,
  type WordPressClientOptions,
  type WordPressRequestOptions,
} from "./client";

export {
  normalizeWordPressAuthor,
  normalizeWordPressCategory,
  normalizeWordPressMedia,
  normalizeWordPressPost,
  normalizeWordPressSeo,
  normalizeWordPressTag,
  stripHtml,
} from "./normalize";
