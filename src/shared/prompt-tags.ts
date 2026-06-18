export function normalizePromptTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const tag of tags) {
    const name = tag.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    normalized.push(name)
  }

  return normalized
}
