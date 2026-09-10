// Football Factory — WordPress GraphQL queries (Phase 2)
// Minimal, explicit queries. Each query is a string constant so that
// the client side never builds GraphQL at runtime.

// SEO fields intentionally NOT selected: the local docker WordPress
// Phase 3 stack does not have a SEO plugin installed, and WPGraphQL
// rejects the whole query when an unknown field is selected. The
// `seo` value is therefore null at runtime; buildPostMetadata and
// buildNewsArticleJsonLd already handle that case via fallbacks
// (post.title, post.excerpt, buildCanonical). Future SEO plugin
// integration only needs to re-add this selection — no normalizer
// or model changes are required.
export const WP_QUERY_POSTS = /* GraphQL */ `
  query FFPosts($first: Int!) {
    posts(first: $first, where: { status: PUBLISH }) {
      nodes {
        id
        databaseId
        slug
        uri
        title
        excerpt
        content
        date
        modified
        status
        featuredImage {
          node {
            id
            sourceUrl
            altText
            mediaDetails { width height }
            mimeType
          }
        }
        author {
          node {
            id
            slug
            name
            description
            avatar { url }
          }
        }
        categories(first: 5) { nodes { id slug name description } }
        tags(first: 10) { nodes { id slug name description } }
      }
    }
  }
`;

export const WP_QUERY_POST_BY_SLUG = /* GraphQL */ `
  query FFPostBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      id
      databaseId
      slug
      uri
      title
      excerpt
      content
      date
      modified
      status
      featuredImage {
        node {
          id
          sourceUrl
          altText
          mediaDetails { width height }
          mimeType
        }
      }
      author {
        node {
          id
          slug
          name
          description
          avatar { url }
        }
      }
      categories(first: 5) { nodes { id slug name description } }
      tags(first: 10) { nodes { id slug name description } }
    }
  }
`;

export const WP_QUERY_CATEGORIES = /* GraphQL */ `
  query FFCategories($first: Int!) {
    categories(first: $first) {
      nodes { id slug name description }
    }
  }
`;

export const WP_QUERY_CATEGORY_BY_SLUG = /* GraphQL */ `
  query FFCategoryBySlug($slug: ID!) {
    category(id: $slug, idType: SLUG) {
      id
      slug
      name
      description
    }
  }
`;

export const WP_QUERY_TAGS = /* GraphQL */ `
  query FFTags($first: Int!) {
    tags(first: $first) {
      nodes { id slug name description }
    }
  }
`;

export const WP_QUERY_AUTHOR = /* GraphQL */ `
  query FFAuthor($id: ID!) {
    user(id: $id, idType: SLUG) {
      id
      slug
      name
      description
      avatar { url }
    }
  }
`;
