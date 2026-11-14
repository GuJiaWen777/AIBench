const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g

/** Returns unique placeholder names in first-appearance order. */
export function extractPlaceholders(body: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1].trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

/**
 * Replaces every known placeholder with its value. Unknown placeholders are
 * left untouched so a partially filled template never silently loses text.
 */
export function renderPrompt(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER_PATTERN, (match, rawName: string) => {
    const name = rawName.trim()
    return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match
  })
}
