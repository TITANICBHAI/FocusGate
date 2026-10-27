import type { BlockPreset } from "./types.ts";

export const BUILT_IN_PRESETS: readonly BlockPreset[] = [
  {
    id: "social",
    name: "Social media",
    emoji: "💬",
    domains: [
      "facebook.com",
      "instagram.com",
      "x.com",
      "tiktok.com",
      "snapchat.com",
      "reddit.com",
      "pinterest.com",
      "tumblr.com",
      "threads.net",
    ],
    builtIn: true,
  },
  {
    id: "video",
    name: "Video & streaming",
    emoji: "▶",
    domains: [
      "youtube.com",
      "netflix.com",
      "twitch.tv",
      "primevideo.com",
      "hulu.com",
      "disneyplus.com",
      "vimeo.com",
      "dailymotion.com",
    ],
    builtIn: true,
  },
  {
    id: "news",
    name: "News",
    emoji: "📰",
    domains: [
      "cnn.com",
      "bbc.com",
      "nytimes.com",
      "foxnews.com",
      "theguardian.com",
      "washingtonpost.com",
      "news.ycombinator.com",
    ],
    builtIn: true,
  },
  {
    id: "shopping",
    name: "Shopping",
    emoji: "🛍",
    domains: ["amazon.com", "ebay.com", "aliexpress.com", "etsy.com", "walmart.com"],
    builtIn: true,
  },
  {
    id: "gaming",
    name: "Gaming",
    emoji: "🎮",
    domains: [
      "store.steampowered.com",
      "steamcommunity.com",
      "epicgames.com",
      "roblox.com",
      "twitch.tv",
    ],
    builtIn: true,
  },
  {
    id: "messaging",
    name: "Messaging",
    emoji: "✉",
    domains: [
      "discord.com",
      "web.whatsapp.com",
      "web.telegram.org",
      "messenger.com",
    ],
    builtIn: true,
  },
];

export function getPresetDomains(presetIds: string[]): string[] {
  const selected = new Set(presetIds);
  return [
    ...new Set(
      BUILT_IN_PRESETS.filter((preset) => selected.has(preset.id)).flatMap(
        (preset) => preset.domains,
      ),
    ),
  ];
}

export function deepFocusDomains(): string[] {
  return getPresetDomains(BUILT_IN_PRESETS.map((preset) => preset.id));
}
