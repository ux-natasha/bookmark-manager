// No imports, so the database's upgrade can use it without a cycle.

// Nested tags are "parent/child": spaces around slashes and empty segments go ("Recipes / Weeknight" → "recipes/weeknight").
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw
      .trim()
      .replace(/^#/, '')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .join('/');
    if (tag) seen.add(tag);
  }
  return [...seen];
}
