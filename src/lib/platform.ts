import type { PageMeta } from './metadata';

export interface Platform {
  id: string;
  label: string;
  // Social posts look better as a screenshot (the site's preview image is usually just an avatar).
  social?: boolean;
}

// Matched against the hostname; a rule matches the domain itself and any subdomain of it.
const BY_HOST: [string[], Platform][] = [
  [['x.com', 'twitter.com'], { id: 'x', label: 'X', social: true }],
  [['bsky.app'], { id: 'bluesky', label: 'Bluesky', social: true }],
  [['threads.net', 'threads.com'], { id: 'threads', label: 'Threads', social: true }],
  [['instagram.com'], { id: 'instagram', label: 'Instagram', social: true }],
  [['linkedin.com'], { id: 'linkedin', label: 'LinkedIn', social: true }],
  [['facebook.com', 'fb.com'], { id: 'facebook', label: 'Facebook', social: true }],
  [['tiktok.com'], { id: 'tiktok', label: 'TikTok', social: true }],
  [['reddit.com', 'redd.it'], { id: 'reddit', label: 'Reddit', social: true }],
  [['news.ycombinator.com'], { id: 'hackernews', label: 'Hacker News', social: true }],
  [['pinterest.com', 'pin.it'], { id: 'pinterest', label: 'Pinterest' }],
  [['youtube.com', 'youtu.be'], { id: 'youtube', label: 'YouTube' }],
  [['vimeo.com'], { id: 'vimeo', label: 'Vimeo' }],
  [['giphy.com'], { id: 'giphy', label: 'GIPHY' }],
  [['tenor.com'], { id: 'tenor', label: 'Tenor' }],
  [['substack.com'], { id: 'substack', label: 'Substack' }],
  [['medium.com'], { id: 'medium', label: 'Medium' }],
  [['dev.to'], { id: 'devto', label: 'DEV' }],
  [['github.com', 'github.io'], { id: 'github', label: 'GitHub' }],
  [['gitlab.com'], { id: 'gitlab', label: 'GitLab' }],
  [['codeberg.org'], { id: 'codeberg', label: 'Codeberg' }],
  [['codepen.io'], { id: 'codepen', label: 'CodePen' }],
  [['npmjs.com'], { id: 'npm', label: 'npm' }],
  [['stackoverflow.com'], { id: 'stackoverflow', label: 'Stack Overflow' }],
  [['figma.com'], { id: 'figma', label: 'Figma' }],
  [['dribbble.com'], { id: 'dribbble', label: 'Dribbble' }],
  [['behance.net'], { id: 'behance', label: 'Behance' }],
  [['are.na'], { id: 'arena', label: 'Are.na' }],
  [['mobbin.com'], { id: 'mobbin', label: 'Mobbin' }],
  [['producthunt.com'], { id: 'producthunt', label: 'Product Hunt' }],
  [['notion.so', 'notion.site'], { id: 'notion', label: 'Notion' }],
  [['docs.google.com', 'drive.google.com'], { id: 'google-docs', label: 'Google Docs' }],
  [['spotify.com'], { id: 'spotify', label: 'Spotify' }],
  [['podcasts.apple.com'], { id: 'apple-podcasts', label: 'Apple Podcasts' }],
  [['wikipedia.org'], { id: 'wikipedia', label: 'Wikipedia' }],
  [['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.in', 'amazon.ca'], { id: 'amazon', label: 'Amazon' }],
  [['etsy.com'], { id: 'etsy', label: 'Etsy' }],
  [['gumroad.com'], { id: 'gumroad', label: 'Gumroad' }],
  [['ghost.io'], { id: 'ghost', label: 'Ghost' }],
  [['beehiiv.com'], { id: 'beehiiv', label: 'beehiiv' }],
];

// Platforms that also run on people's own domains, recognised from clues inside the page.
const BY_HINT: Record<string, Platform> = {
  substack: { id: 'substack', label: 'Substack' },
  medium: { id: 'medium', label: 'Medium' },
  ghost: { id: 'ghost', label: 'Ghost' },
};

const BY_GENERATOR: [RegExp, Platform][] = [
  [/substack/i, BY_HINT.substack],
  [/medium/i, BY_HINT.medium],
  [/ghost/i, BY_HINT.ghost],
  [/mastodon/i, { id: 'mastodon', label: 'Mastodon', social: true }],
  [/wordpress/i, { id: 'wordpress', label: 'WordPress' }],
  [/framer/i, { id: 'framer', label: 'Framer' }],
  [/webflow/i, { id: 'webflow', label: 'Webflow' }],
];

const ALL: Platform[] = [...BY_HOST.map(([, p]) => p), ...BY_GENERATOR.map(([, p]) => p)];

export function detectPlatform(url: string, meta?: PageMeta): Platform | undefined {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  for (const [domains, platform] of BY_HOST) {
    if (domains.some((d) => host === d || host.endsWith('.' + d))) return platform;
  }
  if (!meta) return undefined;

  // enrichBookmark passes a bare {} when the page couldn't be read.
  for (const hint of meta.hints ?? []) if (BY_HINT[hint]) return BY_HINT[hint];
  if (meta.generator) {
    for (const [pattern, platform] of BY_GENERATOR) if (pattern.test(meta.generator)) return platform;
  }
  return undefined;
}

export function platformById(id: string | undefined): Platform | undefined {
  return id ? ALL.find((p) => p.id === id) : undefined;
}
