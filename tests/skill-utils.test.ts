import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildSkillMd,
  copyDir,
  findSkillRoots,
  hashSkillDir,
  parseSkillMd,
  resolveSkillDir
} from '../src/main/skill-utils.ts'
import { diffLines } from '../src/shared/text-diff.ts'

function withTempDir(run: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibench-test-'))
  try {
    run(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('buildSkillMd round-trips user text safely', () => {
  const descriptions = [
    'Use when: user asks for review',
    'line one\nline two',
    'He said "hi"',
    'path C:\\Users\\demo',
    'node:sqlite and more'
  ]

  for (const description of descriptions) {
    const content = buildSkillMd({ name: 'demo', description }, 'body text')
    const parsed = parseSkillMd(content)
    assert.equal(parsed.parseError, undefined, `unexpected parse error for ${description}`)
    assert.equal(parsed.meta.name, 'demo')
    assert.equal(parsed.meta.description, description)
    assert.equal(parsed.body, 'body text')
  }
})

test('parseSkillMd recovers a broken frontmatter so it stays editable', () => {
  const content = '---\nname: demo\ndescription: Use when: x\n---\nbody text'
  const parsed = parseSkillMd(content)
  assert.equal(parsed.meta.name, 'demo')
  assert.equal(parsed.meta.description, 'Use when: x')
  assert.equal(parsed.body, 'body text')
  assert.ok(parsed.parseError)
})

test('copyDir refuses to copy a directory onto itself', () => {
  withTempDir((dir) => {
    const source = path.join(dir, 'skill-a')
    fs.mkdirSync(source)
    fs.writeFileSync(path.join(source, 'SKILL.md'), 'hello')

    assert.throws(() => copyDir(source, source, true), /SOURCE_EQUALS_TARGET/)
    assert.equal(fs.readFileSync(path.join(source, 'SKILL.md'), 'utf-8'), 'hello')
  })
})

test('copyDir refuses overlapping source and destination', () => {
  withTempDir((dir) => {
    const source = path.join(dir, 'skill-a')
    const nested = path.join(source, 'nested')
    fs.mkdirSync(source)
    fs.writeFileSync(path.join(source, 'SKILL.md'), 'hello')

    assert.throws(() => copyDir(source, nested, true), /SOURCE_TARGET_OVERLAP/)
    assert.throws(() => copyDir(source, dir, true), /SOURCE_TARGET_OVERLAP/)
    assert.equal(fs.existsSync(path.join(source, 'SKILL.md')), true)
  })
})

test('copyDir still overwrites a sibling directory', () => {
  withTempDir((dir) => {
    const source = path.join(dir, 'source')
    const target = path.join(dir, 'target')
    fs.mkdirSync(source)
    fs.writeFileSync(path.join(source, 'SKILL.md'), 'new')
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(target, 'SKILL.md'), 'old')

    copyDir(source, target, true)
    assert.equal(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf-8'), 'new')
    assert.equal(fs.existsSync(source), true)
  })
})

test('resolveSkillDir blocks traversal but allows names from other tools', () => {
  const root = path.resolve('/skills-root')
  assert.throws(() => resolveSkillDir(root, '..'), /INVALID_DIR_NAME/)
  assert.throws(() => resolveSkillDir(root, '../escape'), /INVALID_DIR_NAME/)
  assert.throws(() => resolveSkillDir(root, 'a/b'), /INVALID_DIR_NAME/)
  assert.throws(() => resolveSkillDir(root, 'a\\b'), /INVALID_DIR_NAME/)
  assert.throws(() => resolveSkillDir(root, ''), /INVALID_DIR_NAME/)
  assert.equal(resolveSkillDir(root, 'My.Skill_v1'), path.resolve(root, 'My.Skill_v1'))
})

test('findSkillRoots finds skills nested deeper than one level', () => {
  withTempDir((dir) => {
    const skillDir = path.join(dir, 'repo-main', 'skills', 'code-review')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: code-review\n---\n')

    const roots = findSkillRoots(dir)
    assert.deepEqual(roots, [skillDir])
  })
})

test('hashSkillDir matches identical copies and detects edits', () => {
  withTempDir((dir) => {
    const a = path.join(dir, 'a')
    const b = path.join(dir, 'b')
    for (const target of [a, b]) {
      fs.mkdirSync(path.join(target, 'references'), { recursive: true })
      fs.writeFileSync(path.join(target, 'SKILL.md'), '---\nname: demo\n---\n')
      fs.writeFileSync(path.join(target, 'references', 'notes.md'), 'hello')
    }
    assert.equal(hashSkillDir(a), hashSkillDir(b))

    fs.writeFileSync(path.join(b, 'references', 'notes.md'), 'hello world')
    assert.notEqual(hashSkillDir(a), hashSkillDir(b))
  })
})

test('diffLines marks unchanged, deleted and added lines', () => {
  const diff = diffLines('a\nb\nc', 'a\nx\nc')
  assert.deepEqual(
    diff.map((line) => `${line.type}:${line.text}`),
    ['same:a', 'del:b', 'add:x', 'same:c']
  )
})

test('diffLines handles identical text', () => {
  assert.deepEqual(diffLines('same\nfile', 'same\nfile'), [
    { type: 'same', text: 'same' },
    { type: 'same', text: 'file' }
  ])
})
