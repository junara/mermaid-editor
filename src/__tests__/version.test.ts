import { describe, expect, it } from 'vitest'

import { formatVersionLabel, formatVersionTitle } from '../version'

// ローカル時刻で整形するため、期待値もローカル時刻から作る
const BUILD_TIME = new Date(2026, 7, 18, 8, 42).toISOString()

describe('formatVersionLabel', () => {
  it('バージョンとビルド日時を併記する', () => {
    expect(formatVersionLabel('0.1.0', BUILD_TIME)).toBe('v0.1.0 (2026-08-18 08:42)')
  })

  it('ビルド日時が読めない値でもバージョンは出す', () => {
    expect(formatVersionLabel('0.1.0', '')).toBe('v0.1.0')
  })
})

describe('formatVersionTitle', () => {
  it('表示が何の数字なのかを補う', () => {
    expect(formatVersionTitle('0.1.0', BUILD_TIME)).toBe(
      'バージョン 0.1.0 / ビルド日時 2026-08-18 08:42',
    )
  })

  it('ビルド日時が読めない値でも壊れない', () => {
    expect(formatVersionTitle('0.1.0', 'not-a-date')).toBe('バージョン 0.1.0 / ビルド日時 不明')
  })
})
