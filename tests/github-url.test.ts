import test from 'node:test'
import assert from 'node:assert/strict'
import { githubZipUrl, parseGithubUrl } from '../src/main/github-url.ts'

test('parses a repository root URL', () => {
  assert.deepEqual(parseGithubUrl('https://github.com/owner/repo'), {
    owner: 'owner',
    repo: 'repo',
    ref: 'HEAD',
    subdir: ''
  })
})

test('normalizes www, trailing slash, .git suffix and query strings', () => {
  assert.deepEqual(parseGithubUrl('https://www.github.com/owner/repo.git/?tab=readme'), {
    owner: 'owner',
    repo: 'repo',
    ref: 'HEAD',
    subdir: ''
  })
})

test('parses a tree link with branch and subdirectory', () => {
  assert.deepEqual(
    parseGithubUrl('https://github.com/owner/repo/tree/main/skills/pdf-tools'),
    {
      owner: 'owner',
      repo: 'repo',
      ref: 'main',
      subdir: 'skills/pdf-tools'
    }
  )
})

test('parses a tree link without a subdirectory', () => {
  assert.deepEqual(parseGithubUrl('https://github.com/owner/repo/tree/dev'), {
    owner: 'owner',
    repo: 'repo',
    ref: 'dev',
    subdir: ''
  })
})

test('a blob link installs the containing directory', () => {
  assert.deepEqual(
    parseGithubUrl('https://github.com/owner/repo/blob/main/skills/pdf-tools/SKILL.md'),
    {
      owner: 'owner',
      repo: 'repo',
      ref: 'main',
      subdir: 'skills/pdf-tools'
    }
  )
})

test('rejects non-GitHub and insecure URLs', () => {
  const invalid = [
    'http://github.com/owner/repo',
    'https://gitlab.com/owner/repo',
    'https://github.com.evil.test/owner/repo',
    'not a url',
    'https://github.com/owner',
    'https://github.com/owner/repo/issues/1',
    'https://github.com/owner/repo/tree',
    'https://github.com/owner/repo/tree/main/a%2F..%2Fb'
  ]
  for (const url of invalid) {
    assert.throws(() => parseGithubUrl(url), /GITHUB_URL_INVALID/, url)
  }
})

test('builds codeload zip URLs for HEAD and named refs', () => {
  assert.equal(
    githubZipUrl({ owner: 'owner', repo: 'repo', ref: 'HEAD', subdir: '' }),
    'https://codeload.github.com/owner/repo/zip/HEAD'
  )
  assert.equal(
    githubZipUrl({ owner: 'owner', repo: 'repo', ref: 'v1.0.0', subdir: '' }),
    'https://codeload.github.com/owner/repo/zip/v1.0.0'
  )
})
