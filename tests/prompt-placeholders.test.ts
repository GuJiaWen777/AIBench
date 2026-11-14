import test from 'node:test'
import assert from 'node:assert/strict'
import { extractPlaceholders, renderPrompt } from '../src/shared/prompt-placeholders.ts'

test('extractPlaceholders keeps first-seen order and removes duplicates', () => {
  assert.deepEqual(
    extractPlaceholders('Write about {{topic}} for {{ audience }}. Again: {{topic}}.'),
    ['topic', 'audience']
  )
})

test('extractPlaceholders ignores empty and malformed tokens', () => {
  assert.deepEqual(extractPlaceholders('{{}} {{ }} {single} plain text'), [])
})

test('extractPlaceholders supports CJK and punctuation in names', () => {
  assert.deepEqual(extractPlaceholders('{{主题}} {{tone-2}} {{user_name}}'), [
    '主题',
    'tone-2',
    'user_name'
  ])
})

test('renderPrompt replaces every occurrence and keeps unknown tokens', () => {
  const body = 'Hi {{name}}, {{name}}! About {{topic}} and {{missing}}.'
  assert.equal(
    renderPrompt(body, { name: 'Ada', topic: 'testing' }),
    'Hi Ada, Ada! About testing and {{missing}}.'
  )
})

test('renderPrompt allows an empty value to remove a placeholder', () => {
  assert.equal(renderPrompt('a{{x}}b', { x: '' }), 'ab')
})

test('renderPrompt leaves text without placeholders untouched', () => {
  assert.equal(renderPrompt('plain {text}', {}), 'plain {text}')
})
