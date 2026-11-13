/**
 * Content filters are Beta, so every one starts off, for new and migrated
 * users alike. Someone who had switched one on in an earlier version keeps
 * their own choice; only filters they never chose start off.
 */
export const EXISTING_USER_CONTENT_FILTER_DEFAULTS = {
  ytShorts: false,
  igReels: false,
  tiktokFeed: false,
} as const;
