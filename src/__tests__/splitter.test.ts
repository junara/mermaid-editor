import { describe, expect, it, vi } from 'vitest'

import {
  clampRatio,
  createSplitter,
  DEFAULT_RATIO,
  KEY_STEP,
  MAX_RATIO,
  MIN_RATIO,
  ratioFromPointer,
} from '../splitter'

describe('clampRatio', () => {
  it('範囲内はそのまま', () => {
    expect(clampRatio(0.5)).toBe(0.5)
  })

  it('範囲外は 20%〜80% に収める', () => {
    expect(clampRatio(0)).toBe(MIN_RATIO)
    expect(clampRatio(1)).toBe(MAX_RATIO)
    expect(clampRatio(-3)).toBe(MIN_RATIO)
  })

  it('数値でない場合は既定値', () => {
    expect(clampRatio(Number.NaN)).toBe(DEFAULT_RATIO)
  })
})

describe('ratioFromPointer', () => {
  it('コンテナ内の位置を比率に変換する', () => {
    expect(ratioFromPointer(500, { left: 0, width: 1000 })).toBe(0.5)
    expect(ratioFromPointer(300, { left: 100, width: 400 })).toBe(0.5)
  })

  it('端に寄せても上下限を超えない', () => {
    expect(ratioFromPointer(0, { left: 0, width: 1000 })).toBe(MIN_RATIO)
    expect(ratioFromPointer(1000, { left: 0, width: 1000 })).toBe(MAX_RATIO)
  })

  it('幅 0 の場合は既定値', () => {
    expect(ratioFromPointer(10, { left: 0, width: 0 })).toBe(DEFAULT_RATIO)
  })
})

function setup() {
  const container = document.createElement('div')
  const handle = document.createElement('div')
  container.append(handle)
  document.body.append(container)

  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    width: 1000,
  } as DOMRect)

  const onChange = vi.fn<(ratio: number) => void>()
  const onCommit = vi.fn<(ratio: number) => void>()
  const controller = createSplitter({ container, handle, onChange, onCommit })
  return { container, handle, onChange, onCommit, controller }
}

function pointerEvent(type: string, init: Partial<PointerEvent> = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 1, button: 0, ...init })
  return event
}

describe('createSplitter', () => {
  it('setRatio で比率を反映する', () => {
    const { controller, onChange } = setup()
    controller.setRatio(0.35)
    expect(controller.getRatio()).toBe(0.35)
    expect(onChange).toHaveBeenCalledWith(0.35)
  })

  it('setRatio も範囲外は丸める', () => {
    const { controller } = setup()
    controller.setRatio(0.99)
    expect(controller.getRatio()).toBe(MAX_RATIO)
  })

  it('ドラッグ中は onChange、離したときに onCommit を呼ぶ', () => {
    const { handle, onChange, onCommit, controller } = setup()

    handle.dispatchEvent(pointerEvent('pointerdown'))
    handle.dispatchEvent(pointerEvent('pointermove', { clientX: 300 } as Partial<PointerEvent>))

    expect(onChange).toHaveBeenLastCalledWith(0.3)
    expect(onCommit).not.toHaveBeenCalled()

    handle.dispatchEvent(pointerEvent('pointerup'))
    expect(onCommit).toHaveBeenCalledWith(0.3)
    expect(controller.getRatio()).toBe(0.3)
  })

  it('離した後はドラッグ追従しない', () => {
    const { handle, onChange } = setup()
    handle.dispatchEvent(pointerEvent('pointerdown'))
    handle.dispatchEvent(pointerEvent('pointerup'))
    onChange.mockClear()

    handle.dispatchEvent(pointerEvent('pointermove', { clientX: 700 } as Partial<PointerEvent>))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('左ボタン以外では開始しない', () => {
    const { handle, onChange } = setup()
    handle.dispatchEvent(pointerEvent('pointerdown', { button: 2 } as Partial<PointerEvent>))
    handle.dispatchEvent(pointerEvent('pointermove', { clientX: 700 } as Partial<PointerEvent>))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('矢印キーで段階的に変更し、都度 commit する', () => {
    const { handle, onCommit, controller } = setup()
    controller.setRatio(0.5)

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(controller.getRatio()).toBeCloseTo(0.5 + KEY_STEP)

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(controller.getRatio()).toBeCloseTo(0.5)
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('関係のないキーは無視する', () => {
    const { handle, onCommit } = setup()
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('destroy 後はイベントを受け付けない', () => {
    const { handle, onChange, controller } = setup()
    controller.destroy()
    handle.dispatchEvent(pointerEvent('pointerdown'))
    handle.dispatchEvent(pointerEvent('pointermove', { clientX: 700 } as Partial<PointerEvent>))
    expect(onChange).not.toHaveBeenCalled()
  })
})
