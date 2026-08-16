import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const renderMock = vi.fn<(id: string, code: string) => Promise<{ svg: string }>>()
const initializeMock = vi.fn<(config: Record<string, unknown>) => void>()

vi.mock('mermaid', () => ({
  default: {
    initialize: (config: Record<string, unknown>) => initializeMock(config),
    render: (id: string, code: string) => renderMock(id, code),
  },
}))

const {
  clampZoom,
  debounce,
  extractErrorMessage,
  initMermaid,
  MAX_ZOOM,
  MIN_ZOOM,
  renderDiagram,
  stepZoom,
} = await import('../preview')

beforeEach(() => {
  renderMock.mockReset()
  initializeMock.mockClear()
})

describe('extractErrorMessage', () => {
  it('先頭の非空行を 1 行のメッセージにする', () => {
    const error = new Error('Parse error on line 3:\n...\n^ expected NEWLINE')
    expect(extractErrorMessage(error)).toBe('Parse error on line 3:')
  })

  it('メッセージに行番号がなく hash.line がある場合は付記する', () => {
    const error = Object.assign(new Error('Syntax error in text'), { hash: { line: 7 } })
    expect(extractErrorMessage(error)).toBe('Syntax error in text (7 行目)')
  })

  it('メッセージ側に行番号があれば重複させない', () => {
    const error = Object.assign(new Error('Parse error on line 2:'), { hash: { line: 2 } })
    expect(extractErrorMessage(error)).toBe('Parse error on line 2:')
  })

  it('Error 以外も文字列化して扱う', () => {
    expect(extractErrorMessage('boom')).toBe('boom')
    expect(extractErrorMessage(42)).toBe('42')
  })

  it('Error でないオブジェクトでも message があれば使う', () => {
    expect(extractErrorMessage({ message: 'Syntax error in graph' })).toBe('Syntax error in graph')
  })

  it('オブジェクトを [object Object] と表示しない', () => {
    expect(extractErrorMessage({ foo: 'bar' })).toBe('構文エラー')
    expect(extractErrorMessage({ message: { nested: true } })).toBe('構文エラー')
  })

  it('情報がなければ既定メッセージを返す', () => {
    expect(extractErrorMessage(new Error('   \n  '))).toBe('構文エラー')
    expect(extractErrorMessage(null)).toBe('構文エラー')
  })
})

describe('renderDiagram', () => {
  it('成功時は SVG を返す', async () => {
    renderMock.mockResolvedValue({ svg: '<svg></svg>' })
    await expect(renderDiagram('flowchart TD\n A-->B')).resolves.toEqual({
      ok: true,
      svg: '<svg></svg>',
    })
  })

  it('空入力では mermaid を呼ばない', async () => {
    const result = await renderDiagram('   \n  ')
    expect(result).toEqual({ ok: false, message: '入力が空です' })
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('失敗しても例外を投げず、メッセージを返す', async () => {
    renderMock.mockRejectedValue(new Error('Parse error on line 1:'))
    const result = await renderDiagram('bogus')
    expect(result).toEqual({ ok: false, message: 'Parse error on line 1:' })
  })

  it('mermaid が残した一時要素を後始末する', async () => {
    renderMock.mockImplementation((id: string) => {
      const leftover = document.createElement('div')
      leftover.id = `d${id}`
      document.body.append(leftover)
      return Promise.reject(new Error('failed'))
    })

    await renderDiagram('bogus')
    expect(document.body.querySelector('div[id^="dmermaid-render-"]')).toBeNull()
  })
})

describe('initMermaid', () => {
  it('htmlLabels: false で初期化し、二度目は何もしない', async () => {
    // モジュールを読み直して「未初期化」の状態から検証する
    vi.resetModules()
    const fresh = await import('../preview')

    fresh.initMermaid()
    fresh.initMermaid()

    expect(initializeMock).toHaveBeenCalledTimes(1)
    const config = initializeMock.mock.calls[0]?.[0] ?? {}
    expect(config.htmlLabels).toBe(false)
    expect(config.flowchart).toEqual({ htmlLabels: false })
    expect(config.startOnLoad).toBe(false)
    expect(config.fontFamily).toBe(fresh.SYSTEM_FONT_STACK)
  })

  it('初期化済みなら renderDiagram は再初期化しない', async () => {
    renderMock.mockResolvedValue({ svg: '<svg></svg>' })
    initMermaid()
    initializeMock.mockClear()
    await renderDiagram('flowchart TD\n A-->B')
    expect(initializeMock).not.toHaveBeenCalled()
  })
})

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('待ち時間経過後に一度だけ実行する', () => {
    const spy = vi.fn<(value: string) => void>()
    const debounced = debounce(spy, 300)

    debounced('a')
    debounced('b')
    debounced('c')
    expect(spy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(299)
    expect(spy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('c')
  })

  it('cancel すると実行されない', () => {
    const spy = vi.fn<() => void>()
    const debounced = debounce(spy, 300)
    debounced()
    debounced.cancel()
    vi.advanceTimersByTime(1000)
    expect(spy).not.toHaveBeenCalled()
  })

  it('flush で待機中の呼び出しを直ちに実行する', () => {
    const spy = vi.fn<(value: string) => void>()
    const debounced = debounce(spy, 1000)

    debounced('a')
    debounced('b')
    debounced.flush()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('b')

    // flush 後にタイマーが残っていて二重実行されないこと
    vi.advanceTimersByTime(2000)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('待機中の呼び出しがなければ flush は何もしない', () => {
    const spy = vi.fn<() => void>()
    const debounced = debounce(spy, 300)

    debounced.flush()
    expect(spy).not.toHaveBeenCalled()

    debounced()
    vi.advanceTimersByTime(300)
    debounced.flush()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('cancel 後は flush しても実行されない', () => {
    const spy = vi.fn<() => void>()
    const debounced = debounce(spy, 300)
    debounced()
    debounced.cancel()
    debounced.flush()
    expect(spy).not.toHaveBeenCalled()
  })

  it('間隔が空けば都度実行する', () => {
    const spy = vi.fn<() => void>()
    const debounced = debounce(spy, 300)
    debounced()
    vi.advanceTimersByTime(300)
    debounced()
    vi.advanceTimersByTime(300)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('clampZoom / stepZoom', () => {
  it('範囲内はそのまま', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(1.25)).toBe(1.25)
  })

  it('範囲外は 50%〜200% に丸める', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM)
    expect(clampZoom(5)).toBe(MAX_ZOOM)
  })

  it('数値でない場合は 1 に戻す', () => {
    expect(clampZoom(Number.NaN)).toBe(1)
  })

  it('1 段階ずつ増減する', () => {
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(1, -1)).toBe(0.9)
  })

  it('浮動小数の誤差を丸める', () => {
    expect(stepZoom(stepZoom(stepZoom(1, 1), 1), 1)).toBe(1.3)
  })

  it('上下限を超えない', () => {
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM)
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM)
  })
})
