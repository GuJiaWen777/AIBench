export interface TextDiffLine {
  type: 'same' | 'add' | 'del'
  text: string
}

// Keeps the LCS table bounded so a huge file cannot freeze the renderer.
const MAX_LINES = 20000
const MAX_CELLS = 1_000_000

function fullReplace(before: string[], after: string[]): TextDiffLine[] {
  return [
    ...before.map((text) => ({ type: 'del' as const, text })),
    ...after.map((text) => ({ type: 'add' as const, text }))
  ]
}

export function diffLines(before: string, after: string): TextDiffLine[] {
  if (before === after) return before.split('\n').map((text) => ({ type: 'same', text }))

  const a = before.split('\n')
  const b = after.split('\n')
  if (a.length > MAX_LINES || b.length > MAX_LINES || a.length * b.length > MAX_CELLS) {
    return fullReplace(a, b)
  }

  const dp: Uint32Array[] = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const result: TextDiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ type: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'del', text: a[i] })
      i += 1
    } else {
      result.push({ type: 'add', text: b[j] })
      j += 1
    }
  }
  while (i < a.length) {
    result.push({ type: 'del', text: a[i] })
    i += 1
  }
  while (j < b.length) {
    result.push({ type: 'add', text: b[j] })
    j += 1
  }
  return result
}
