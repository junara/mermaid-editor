import { describe, expect, it } from 'vitest'

import { needsReplaceConfirmation, normalizeIncomingText, parseSharedText } from '../launch'
import { SAMPLE_DOCUMENT } from '../storage'

describe('parseSharedText', () => {
  it('text パラメータの内容を返す', () => {
    expect(parseSharedText('?text=graph%20TD')).toBe('graph TD')
  })

  it('パラメータがなければ null', () => {
    expect(parseSharedText('')).toBeNull()
    expect(parseSharedText('?title=foo')).toBeNull()
  })

  it('値は加工せずそのまま返す(正規化は取り込み側の責務)', () => {
    expect(parseSharedText('?text=%20%20graph%20TD%0D%0A')).toBe('  graph TD\r\n')
  })

  it('他のパラメータが混在していても取り出せる', () => {
    expect(parseSharedText('?title=foo&text=pie&url=https%3A%2F%2Fexample.com')).toBe('pie')
  })
})

describe('normalizeIncomingText', () => {
  it('CRLF と CR を LF に揃える', () => {
    expect(normalizeIncomingText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('前後の空白を落とす', () => {
    expect(normalizeIncomingText('\n\n  flowchart TD\n\n')).toBe('flowchart TD')
  })

  it('BOM を取り除く', () => {
    expect(normalizeIncomingText('\uFEFFflowchart TD')).toBe('flowchart TD')
  })

  it('中間の空行は保つ', () => {
    expect(normalizeIncomingText('a\n\nb')).toBe('a\n\nb')
  })
})

describe('needsReplaceConfirmation', () => {
  it('編集済みの内容があれば確認する', () => {
    expect(needsReplaceConfirmation('flowchart TD\n  A --> B')).toBe(true)
  })

  it('空なら確認しない', () => {
    expect(needsReplaceConfirmation('')).toBe(false)
    expect(needsReplaceConfirmation('  \n ')).toBe(false)
  })

  it('初回サンプルのままなら確認しない', () => {
    expect(needsReplaceConfirmation(SAMPLE_DOCUMENT)).toBe(false)
  })

  it('サンプルを 1 行でも変えていれば確認する', () => {
    expect(needsReplaceConfirmation(`${SAMPLE_DOCUMENT}  E --> F\n`)).toBe(true)
  })
})
