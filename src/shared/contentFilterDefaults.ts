/**
 * Preserve the three content filters that the v1 script hid unconditionally.
 * New users still start with no content filters enabled.
 */
export const EXISTING_USER_CONTENT_FILTER_DEFAULTS = {
  ytShorts: true,
  igReels: true,
  tiktokFeed: true,
} as const;
