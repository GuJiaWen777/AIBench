export interface GithubSource {
  owner: string
  repo: string
  /** Branch, tag or commit; HEAD means the repository's default branch. */
  ref: string
  /** Optional subdirectory inside the repository, using forward slashes. */
  subdir: string
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/

function invalid(): Error {
  return new Error('GITHUB_URL_INVALID')
}

/**
 * Accepts https://github.com/owner/repo and /tree/<ref>/<path> links.
 * Branch names containing "/" are ambiguous without an API call and are not
 * supported here; users can paste the repository root instead.
 */
export function parseGithubUrl(input: string): GithubSource {
  const trimmed = input.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw invalid()
  }

  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || (host !== 'github.com' && host !== 'www.github.com')) {
    throw invalid()
  }

  let parts: string[]
  try {
    parts = url.pathname
      .split('/')
      .filter(Boolean)
      .map((part) => decodeURIComponent(part))
  } catch {
    throw invalid()
  }
  if (parts.length < 2) throw invalid()

  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')
  if (!SAFE_SEGMENT.test(owner) || !SAFE_SEGMENT.test(repo)) throw invalid()

  let ref = 'HEAD'
  let subdir = ''
  const rest = parts.slice(2)
  if (rest.length > 0) {
    const kind = rest[0]
    if (kind !== 'tree' && kind !== 'blob') throw invalid()
    if (rest.length < 2) throw invalid()
    ref = rest[1]
    if (!SAFE_SEGMENT.test(ref) || ref === '.' || ref === '..') throw invalid()
    const pathParts = rest.slice(2)
    // A blob URL points at a file; install the directory that contains it.
    if (kind === 'blob') pathParts.pop()
    if (pathParts.some((part) => !SAFE_SEGMENT.test(part) || part === '.' || part === '..')) {
      throw invalid()
    }
    subdir = pathParts.join('/')
  }

  return { owner, repo, ref, subdir }
}

/** Direct zip download endpoint; HEAD resolves to the default branch. */
export function githubZipUrl(source: GithubSource): string {
  const owner = encodeURIComponent(source.owner)
  const repo = encodeURIComponent(source.repo)
  const ref = source.ref === 'HEAD' ? 'HEAD' : encodeURIComponent(source.ref)
  return `https://codeload.github.com/${owner}/${repo}/zip/${ref}`
}

export function githubRepoLabel(source: GithubSource): string {
  return `${source.owner}/${source.repo}`
}
