import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const docs = "docs";
const BASE = "https://titanicbhai.github.io/FocusGate";
const read = (path: string) => readFileSync(path, "utf8");
const pages = readdirSync(docs).filter((name) => name.endsWith(".html"));
const indexed = ["index.html", "install.html", "features.html", "faq.html", "support.html", "privacy-policy.html", "terms-of-service.html"];
const meta = (html: string, name: string) => new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(html)?.[1];
const property = (html: string, name: string) => new RegExp(`<meta property="${name}" content="([^"]*)"`).exec(html)?.[1];
const graph = (html: string): Array<Record<string, unknown>> => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return blocks.flatMap((block) => (JSON.parse(block[1]) as { "@graph": Array<Record<string, unknown>> })["@graph"]);
};

describe("the website pages", () => {
  it("are all generated, and the generator output matches docs/ exactly", () => {
    const out = mkdtempSync(join(tmpdir(), "fg-site-"));
    execFileSync("node", ["tools/site/build.mjs"], { env: { ...process.env, SITE_OUT: out, SITE_URL: BASE }, stdio: "pipe" });
    for (const name of readdirSync(out)) expect(read(join(docs, name)), `${name} is stale: run npm run site:build`).toBe(read(join(out, name)));
  });

  for (const page of indexed) {
    describe(page, () => {
      const html = read(join(docs, page));

      it("has a short title and description, a canonical URL and social tags", () => {
        const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
        const description = meta(html, "description") ?? "";
        expect(title.replace(/&amp;/g, "&").length).toBeGreaterThan(10);
        expect(title.replace(/&amp;/g, "&").length).toBeLessThanOrEqual(70);
        expect(description.length).toBeGreaterThan(60);
        expect(description.length).toBeLessThanOrEqual(160);
        const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
        expect(canonical).toBe(page === "index.html" ? `${BASE}/` : `${BASE}/${page}`);
        expect(property(html, "og:url")).toBe(canonical);
        expect(property(html, "og:image")).toBe(`${BASE}/assets/og-image.png`);
        expect(meta(html, "twitter:card")).toBe("summary_large_image");
        expect(meta(html, "robots")).toContain("index");
      });

      it("has exactly one h1 and a skip link and main landmark", () => {
        expect(html.match(/<h1[ >]/g)).toHaveLength(1);
        expect(html).toContain('<a class="skip" href="#main">');
        expect(html).toContain('<main id="main">');
        expect(html).toContain('<html lang="en">');
      });

      it("has valid JSON-LD with the organization, the website and the page", () => {
        const types = graph(html).map((node) => node["@type"]);
        expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "WebPage"]));
      });
    });
  }

  it("describe the app without inventing a rating", () => {
    const app = graph(read(join(docs, "index.html"))).find((node) => node["@type"] === "SoftwareApplication") as Record<string, unknown>;
    expect(app.name).toBe("FocusGate: Website Blocker & Focus Timer");
    expect(app.applicationCategory).toBe("BrowserApplication");
    expect((app.offers as { price: string }).price).toBe("0");
    expect(app.softwareVersion).toBe((JSON.parse(read("public/manifest.json")) as { version: string }).version);
    expect(JSON.stringify(app)).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
  });

  it("put every FAQ question in FAQPage markup, matching the page", () => {
    const html = read(join(docs, "faq.html"));
    const faq = graph(html).find((node) => node["@type"] === "FAQPage") as { mainEntity: Array<{ name: string }> };
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(10);
    const shown = [...html.matchAll(/<summary>([^<]*)<\/summary>/g)].length;
    expect(shown).toBe(faq.mainEntity.length);
  });

  it("give the install page a HowTo for Chrome with the real steps", () => {
    const how = graph(read(join(docs, "install.html"))).find((node) => node["@type"] === "HowTo") as { step: Array<{ text: string }> };
    expect(how.step).toHaveLength(5);
    expect(how.step.map((s) => s.text).join(" ")).toMatch(/Load unpacked/);
  });

  it("link to the three places FocusGate can be installed from", () => {
    const home = read(join(docs, "index.html"));
    expect(home).toContain("https://addons.mozilla.org/en-US/firefox/addon/focusgate-web/");
    expect(home).toContain("https://microsoftedge.microsoft.com/addons/detail/mmjhejklaaljidnmabjiloceniacihkk");
    expect(home).toContain("https://github.com/TITANICBHAI/FocusGate/releases/latest/download/focusgate-chrome.zip");
    expect(home).not.toMatch(/chromewebstore\.google\.com/);
  });

  it("have every internal link, anchor and image resolve", () => {
    for (const page of pages) {
      const html = read(join(docs, page));
      for (const [, href] of html.matchAll(/(?:href|src|srcset)="([^"#:]+)(?:#([^"]*))?"/g)) {
        if (!href || href.startsWith("http") || href.startsWith("//")) continue;
        expect(existsSync(join(docs, href)), `${page} points at missing ${href}`).toBe(true);
      }
      for (const [, file, id] of html.matchAll(/href="([a-z-]+\.html)#([^"]+)"/g)) {
        expect(read(join(docs, file)), `${page} links to #${id} on ${file}`).toContain(`id="${id}"`);
      }
    }
  });

  it("have every absolute asset URL (social image, schema images, icons) exist in docs/assets", () => {
    for (const page of pages) {
      for (const [, file] of read(join(docs, page)).matchAll(/titanicbhai\.github\.io\/FocusGate\/assets\/([A-Za-z0-9_./-]+)/g)) {
        expect(existsSync(join(docs, "assets", file)), `${page} references missing assets/${file}`).toBe(true);
      }
    }
  });

  it("every image has alt text and a size", () => {
    for (const page of pages) {
      for (const [tag] of read(join(docs, page)).matchAll(/<img [^>]*>/g)) {
        expect(tag, `${page}: ${tag}`).toMatch(/ alt="/);
        expect(tag, `${page}: ${tag}`).toMatch(/ width="\d+"/);
        expect(tag, `${page}: ${tag}`).toMatch(/ height="\d+"/);
      }
    }
  });

  it("no longer mention the old product name or a PIN", () => {
    for (const page of pages) expect(read(join(docs, page))).not.toMatch(/FocusFlow|\bPIN\b|cdn\.tailwindcss|<script src/);
  });

  it("keep the privacy policy complete: every manifest permission is explained", () => {
    const manifest = JSON.parse(read("public/manifest.json")) as { permissions: string[] };
    const policy = read(join(docs, "privacy-policy.html"));
    for (const permission of manifest.permissions) expect(policy, permission).toContain(permission);
    expect(policy).toContain("&lt;all_urls&gt;");
  });

  it("keep the old chrome-install.html link working by sending people to the install page", () => {
    const html = read(join(docs, "chrome-install.html"));
    expect(html).toContain("install.html#chrome");
    expect(html).toContain("noindex");
  });
});

describe("the files for search engines and AI assistants", () => {
  it("list every indexed page in sitemap.xml and nothing else", () => {
    const sitemap = read(join(docs, "sitemap.xml"));
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.sort()).toEqual(indexed.map((p) => (p === "index.html" ? `${BASE}/` : `${BASE}/${p}`)).sort());
  });

  it("point robots.txt at the sitemap and allow the AI crawlers", () => {
    const robots = read(join(docs, "robots.txt"));
    expect(robots).toContain(`Sitemap: ${BASE}/sitemap.xml`);
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) expect(robots).toMatch(new RegExp(`User-agent: ${bot}\\nAllow: /`));
    expect(robots).not.toMatch(/Disallow: \//);
  });

  it("describe FocusGate in llms.txt and llms-full.txt with the real install links", () => {
    const short = read(join(docs, "llms.txt"));
    const full = read(join(docs, "llms-full.txt"));
    expect(short.startsWith("# FocusGate: Website Blocker & Focus Timer")).toBe(true);
    expect(short).toContain("> ");
    expect(short).toContain("addons.mozilla.org/en-US/firefox/addon/focusgate-web/");
    expect(full).toContain("microsoftedge.microsoft.com/addons/detail/mmjhejklaaljidnmabjiloceniacihkk");
    expect(full).toContain("chrome://extensions");
    expect(full).toContain("### Is FocusGate free?");
  });
});
