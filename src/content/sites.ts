import { matchesDomain } from "../shared/domains.ts";
import { EXISTING_USER_CONTENT_FILTER_DEFAULTS } from "../shared/contentFilterDefaults.ts";

export interface KeywordTarget {
  /** Elements examined for a hide-word match. */
  containerSelector: string;
  /** Empty means inspect the container's textContent. */
  textSelectors: readonly string[];
  /** Optional ancestor to hide instead of the inspected container. */
  hideSelector?: string;
}

export interface ContentFilterDefinition {
  id: string;
  /** CSS-first selectors; these do not require a MutationObserver. */
  selectors: readonly string[];
  /** Null means selectors have not been verified against a live site. */
  verified: string | null;
  /** Set only for filters that v1 hid unconditionally. */
  defaultForExistingUsers?: boolean;
  keywordTargets?: readonly KeywordTarget[];
}

export interface ContentSiteDefinition {
  /** Exact host or dot-boundary suffixes; never substring matches. */
  hosts: readonly string[];
  /** Kept aligned with the active v1 manifest until WP5. */
  matches: readonly string[];
  /** Optional path restriction, e.g. Google search results only. */
  pathPrefix?: string;
  filters: readonly ContentFilterDefinition[];
}

const UNVERIFIED = null;

export const CONTENT_SITES: readonly ContentSiteDefinition[] = [
  {
    hosts: ["youtube.com"],
    matches: ["*://*.youtube.com/*"],
    filters: [
      {
        id: "ytShorts",
        selectors: [
          // Shelves on the home page, search results and watch page.
          "ytd-rich-shelf-renderer[is-shorts]",
          "ytd-reel-shelf-renderer",
          "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
          "ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)",
          // Single Shorts that sit in normal grids and result lists.
          "ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model)",
          "ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model-v2)",
          'ytd-rich-item-renderer:has(a[href^="/shorts/"])',
          'ytd-video-renderer:has(a[href^="/shorts/"])',
          'ytd-compact-video-renderer:has(a[href^="/shorts/"])',
          // The Shorts entry in the left menu.
          'ytd-guide-entry-renderer a[title="Shorts"]',
          'ytd-mini-guide-entry-renderer a[title="Shorts"]',
          'ytd-guide-entry-renderer:has(a[title="Shorts"])',
          'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
          'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
        ],
        verified: UNVERIFIED,
        defaultForExistingUsers:
          EXISTING_USER_CONTENT_FILTER_DEFAULTS.ytShorts,
      },
      {
        id: "ytHomeFeed",
        selectors: ['ytd-browse[page-subtype="home"] ytd-rich-grid-renderer'],
        verified: UNVERIFIED,
      },
      {
        id: "ytRecommendations",
        selectors: [
          "#related",
          "ytd-watch-next-secondary-results-renderer",
          "ytd-watch-flexy #secondary-inner #related",
          // The suggestions that cover the player when a video ends.
          ".ytp-ce-element",
          ".ytp-endscreen-content",
        ],
        verified: UNVERIFIED,
      },
      {
        id: "ytComments",
        selectors: ["ytd-comments#comments", "ytd-comments", "#comments"],
        verified: UNVERIFIED,
      },
      {
        id: "keywordHide",
        selectors: [],
        verified: UNVERIFIED,
        keywordTargets: [
          {
            containerSelector:
              "ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, ytd-reel-item-renderer",
            textSelectors: ["#video-title", ".ytd-reel-item-renderer"],
          },
        ],
      },
    ],
  },
  {
    hosts: ["www.google.com"],
    matches: ["*://*.google.com/*"],
    pathPrefix: "/search",
    filters: [
      {
        id: "keywordHide",
        selectors: [],
        verified: UNVERIFIED,
        keywordTargets: [
          { containerSelector: ".g", textSelectors: ["h3"] },
        ],
      },
    ],
  },
  {
    hosts: ["reddit.com"],
    matches: ["*://*.reddit.com/*"],
    filters: [
      {
        id: "keywordHide",
        selectors: [],
        verified: UNVERIFIED,
        keywordTargets: [
          {
            containerSelector: "shreddit-post, .Post",
            textSelectors: ["h1, h2, h3, [slot='title']"],
          },
        ],
      },
    ],
  },
  {
    hosts: ["x.com", "twitter.com"],
    matches: ["*://*.twitter.com/*", "*://*.x.com/*"],
    filters: [
      {
        id: "xTrends",
        selectors: [
          '[data-testid="trend"]',
          '[aria-label="Timeline: Trending now"]',
          '[aria-label="Who to follow"]',
        ],
        verified: UNVERIFIED,
      },
      {
        id: "keywordHide",
        selectors: [],
        verified: UNVERIFIED,
        keywordTargets: [
          {
            containerSelector: '[data-testid="tweet"]',
            textSelectors: ['[data-testid="tweetText"]'],
            hideSelector: '[data-testid="cellInnerDiv"]',
          },
        ],
      },
    ],
  },
  {
    hosts: ["instagram.com"],
    matches: ["*://*.instagram.com/*"],
    filters: [
      {
        id: "igReels",
        selectors: ['a[href^="/reels/"]', 'a[href*="/reels/"]'],
        verified: UNVERIFIED,
        defaultForExistingUsers:
          EXISTING_USER_CONTENT_FILTER_DEFAULTS.igReels,
      },
      {
        id: "igExplore",
        selectors: ['a[href="/explore/"]'],
        verified: UNVERIFIED,
      },
      {
        id: "keywordHide",
        selectors: [],
        verified: UNVERIFIED,
        keywordTargets: [
          {
            containerSelector: "article",
            textSelectors: ['span[dir="auto"]'],
          },
        ],
      },
    ],
  },
  {
    hosts: ["tiktok.com"],
    matches: ["*://*.tiktok.com/*"],
    filters: [
      {
        id: "tiktokFeed",
        selectors: [
          '[data-e2e="recommend-list-item-container"]',
          '[data-e2e="explore-item"]',
        ],
        verified: UNVERIFIED,
        defaultForExistingUsers:
          EXISTING_USER_CONTENT_FILTER_DEFAULTS.tiktokFeed,
      },
      {
        id: "keywordHide",
        selectors: [],
        verified: UNVERIFIED,
        keywordTargets: [
          {
            containerSelector:
              '[data-e2e="recommend-list-item-container"], [data-e2e="explore-item"]',
            textSelectors: [],
          },
        ],
      },
    ],
  },
  {
    hosts: ["linkedin.com"],
    matches: ["*://*.linkedin.com/*"],
    filters: [
      {
        id: "linkedinFeed",
        selectors: [
          ".feed-shared-update-v2",
          '[data-view-name="feed-full-update"]',
          '[data-finite-scroll-hotkey-context="FEED"]',
        ],
        verified: UNVERIFIED,
      },
      {
        id: "keywordHide",
        selectors: [],
        verified: UNVERIFIED,
        keywordTargets: [
          {
            containerSelector: ".feed-shared-update-v2",
            textSelectors: [
              ".feed-shared-update-v2__commentary, .feed-shared-inline-show-more-text",
            ],
          },
        ],
      },
    ],
  },
];

const CONTENT_FILTER_LABELS: Record<string, string> = {
  ytShorts: "YouTube Shorts",
  ytHomeFeed: "YouTube home feed",
  ytRecommendations: "YouTube recommendations",
  ytComments: "YouTube comments",
  igReels: "Instagram Reels",
  igExplore: "Instagram Explore",
  xTrends: "X trends",
  tiktokFeed: "TikTok feed",
  linkedinFeed: "LinkedIn feed",
  keywordHide: "Keyword hiding",
};

/** One plain line per filter, shown under its switch in Settings. */
const CONTENT_FILTER_DESCRIPTIONS: Record<string, string> = {
  ytShorts:
    "Hides Shorts shelves and the Shorts menu entry, and opens Shorts links as normal videos.",
  ytHomeFeed: "Hides the video grid on the YouTube home page.",
  ytRecommendations:
    "Hides the suggested videos beside the player and the end-of-video suggestions.",
  ytComments: "Hides comments under YouTube videos.",
  igReels: "Hides the Reels tab and Reels links on Instagram.",
  igExplore: "Hides the Explore tab on Instagram.",
  xTrends: "Hides trending topics and “Who to follow” on X.",
  tiktokFeed: "Hides the For You and Explore videos on TikTok.",
  linkedinFeed: "Hides the post feed on LinkedIn.",
  keywordHide:
    "Hides posts and results that contain your hide words, on YouTube, Reddit, X, Instagram, TikTok, LinkedIn and Google search.",
};

export const CONTENT_FILTER_OPTIONS = [
  ...new Set(CONTENT_SITES.flatMap((site) => site.filters.map((filter) => filter.id))),
].map((id) => ({
  id,
  label: CONTENT_FILTER_LABELS[id] ?? id,
  description: CONTENT_FILTER_DESCRIPTIONS[id] ?? "",
}));

const SHORTS_PATH = /^\/shorts\/([A-Za-z0-9_-]{5,})/;

/**
 * Where a YouTube Shorts page should go instead, or null when the page is not
 * a Short. The same video opens in the normal player, so this does not depend
 * on YouTube's page layout.
 */
export function shortsRedirectTarget(
  url: Pick<URL, "hostname" | "pathname" | "origin">,
): string | null {
  if (!matchesDomain(url.hostname, "youtube.com")) return null;
  const match = SHORTS_PATH.exec(url.pathname);
  return match ? `${url.origin}/watch?v=${match[1]}` : null;
}

export const CONTENT_SCRIPT_MATCHES = CONTENT_SITES.flatMap((site) => [
  ...site.matches,
]);

export function getContentSiteForHost(
  hostname: string,
): ContentSiteDefinition | undefined {
  return CONTENT_SITES.find((site) =>
    site.hosts.some((host) => matchesDomain(hostname, host)),
  );
}

export function getContentSiteForUrl(
  url: Pick<URL, "hostname" | "pathname">,
): ContentSiteDefinition | undefined {
  const site = getContentSiteForHost(url.hostname);
  if (site?.pathPrefix && !url.pathname.startsWith(site.pathPrefix)) {
    return undefined;
  }
  return site;
}

export function getEnabledKeywordTargets(
  site: ContentSiteDefinition,
  contentFilters: Record<string, boolean>,
): Array<{ filterId: string; target: KeywordTarget }> {
  return site.filters.flatMap((filter) =>
    contentFilters[filter.id] === true
      ? (filter.keywordTargets ?? []).map((target) => ({
          filterId: filter.id,
          target,
        }))
      : [],
  );
}

export function getAllKeywordTargets(
  site: ContentSiteDefinition,
): Array<{ filterId: string; target: KeywordTarget }> {
  return site.filters.flatMap((filter) =>
    (filter.keywordTargets ?? []).map((target) => ({
      filterId: filter.id,
      target,
    })),
  );
}

export function buildFilterCss(
  site: ContentSiteDefinition,
  contentFilters: Record<string, boolean>,
  hideKeywords: boolean,
): string {
  const selectors = site.filters
    .filter(
      (filter) =>
        filter.selectors.length > 0 && contentFilters[filter.id] === true,
    )
    .flatMap((filter) => filter.selectors);
  const rules = selectors.map(
    (selector) => `${selector} { display: none !important; }`,
  );
  if (hideKeywords) {
    rules.push('[data-fg-hidden="1"] { display: none !important; }');
  }
  return rules.join("\n");
}

export function getSiteSelectors(site: ContentSiteDefinition): string[] {
  return [
    ...new Set(
      site.filters.flatMap((filter) => [
        ...filter.selectors,
        ...(filter.keywordTargets ?? []).flatMap((target) => [
          target.containerSelector,
          ...target.textSelectors,
          ...(target.hideSelector ? [target.hideSelector] : []),
        ]),
      ]),
    ),
  ];
}
