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
          "ytd-rich-shelf-renderer[is-shorts]",
          "ytd-reel-shelf-renderer",
          'ytd-guide-entry-renderer a[title="Shorts"]',
          'ytd-mini-guide-entry-renderer a[title="Shorts"]',
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
        selectors: ["#related", "ytd-watch-next-secondary-results-renderer"],
        verified: UNVERIFIED,
      },
      {
        id: "ytComments",
        selectors: ["ytd-comments#comments"],
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
        selectors: ['[data-testid="trend"]', '[aria-label="Who to follow"]'],
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
