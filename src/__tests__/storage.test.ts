import { describe, expect, it } from 'vitest'

import {
  DOCUMENT_KEY,
  isQuotaExceeded,
  loadDocument,
  loadDocumentOrSample,
  loadSplitRatio,
  SAMPLE_DOCUMENT,
  saveDocument,
  saveSplitRatio,
  SPLIT_RATIO_KEY,
  type StorageLike,
} from '../storage'

class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>()
  constructor(private readonly onSet?: (key: string, value: string) => void) {}

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.onSet?.(key, value)
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

function quotaError(): DOMException {
  return new DOMException('exceeded', 'QuotaExceededError')
}

describe('isQuotaExceeded', () => {
  it('QuotaExceededError を検出する', () => {
    expect(isQuotaExceeded(quotaError())).toBe(true)
  })

  it('Firefox の名称も検出する', () => {
    expect(isQuotaExceeded(new DOMException('x', 'NS_ERROR_DOM_QUOTA_REACHED'))).toBe(true)
  })

  it('無関係な例外は false', () => {
    expect(isQuotaExceeded(new Error('boom'))).toBe(false)
    expect(isQuotaExceeded('boom')).toBe(false)
  })
})

describe('saveDocument / loadDocument', () => {
  it('保存した内容を復元できる', () => {
    const storage = new FakeStorage()
    expect(saveDocument('graph TD; A-->B', storage)).toEqual({ ok: true })
    expect(storage.getItem(DOCUMENT_KEY)).toBe('graph TD; A-->B')
    expect(loadDocument(storage)).toBe('graph TD; A-->B')
  })

  it('未保存なら null を返す', () => {
    expect(loadDocument(new FakeStorage())).toBeNull()
  })

  it('容量超過なら保存をスキップして quota を返す', () => {
    const storage = new FakeStorage(() => {
      throw quotaError()
    })
    const result = saveDocument('x', storage)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('quota')
    expect(storage.getItem(DOCUMENT_KEY)).toBeNull()
  })

  it('その他の例外は unavailable を返す', () => {
    const storage = new FakeStorage(() => {
      throw new Error('disabled')
    })
    const result = saveDocument('x', storage)
    expect(result.ok === false && result.reason).toBe('unavailable')
  })

  it('storage が使えない場合も例外を投げない', () => {
    const result = saveDocument('x', null)
    expect(result.ok === false && result.reason).toBe('unavailable')
    expect(loadDocument(null)).toBeNull()
  })
})

describe('loadDocumentOrSample', () => {
  it('初回起動ではサンプル図を返す', () => {
    expect(loadDocumentOrSample(new FakeStorage())).toBe(SAMPLE_DOCUMENT)
  })

  it('保存済みなら保存内容を優先する', () => {
    const storage = new FakeStorage()
    saveDocument('pie title x', storage)
    expect(loadDocumentOrSample(storage)).toBe('pie title x')
  })

  it('空文字で保存済みならサンプルに戻さない', () => {
    const storage = new FakeStorage()
    saveDocument('', storage)
    expect(loadDocumentOrSample(storage)).toBe('')
  })
})

describe('saveSplitRatio / loadSplitRatio', () => {
  it('往復できる', () => {
    const storage = new FakeStorage()
    saveSplitRatio(0.42, storage)
    expect(storage.getItem(SPLIT_RATIO_KEY)).toBe('0.42')
    expect(loadSplitRatio(storage)).toBe(0.42)
  })

  it('未保存なら null', () => {
    expect(loadSplitRatio(new FakeStorage())).toBeNull()
  })

  it('数値として不正な値は null', () => {
    const storage = new FakeStorage()
    storage.setItem(SPLIT_RATIO_KEY, 'abc')
    expect(loadSplitRatio(storage)).toBeNull()
  })

  it('範囲外の値は null', () => {
    const storage = new FakeStorage()
    storage.setItem(SPLIT_RATIO_KEY, '0')
    expect(loadSplitRatio(storage)).toBeNull()
    storage.setItem(SPLIT_RATIO_KEY, '1')
    expect(loadSplitRatio(storage)).toBeNull()
    storage.setItem(SPLIT_RATIO_KEY, '-0.5')
    expect(loadSplitRatio(storage)).toBeNull()
  })
})
