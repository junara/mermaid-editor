/** エディタ側ペインが取りうる最小比率。 */
export const MIN_RATIO = 0.2
/** エディタ側ペインが取りうる最大比率。 */
export const MAX_RATIO = 0.8
/** 保存データがないときの既定比率。 */
export const DEFAULT_RATIO = 0.5
/** キーボード操作 1 回あたりの変化量。 */
export const KEY_STEP = 0.02

/** 比率を許容範囲に収める。 */
export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_RATIO
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))
}

/** ポインタの X 座標をコンテナ内の比率に変換する。 */
export function ratioFromPointer(clientX: number, bounds: { left: number; width: number }): number {
  if (bounds.width <= 0) return DEFAULT_RATIO
  return clampRatio((clientX - bounds.left) / bounds.width)
}

export interface SplitterOptions {
  /** 分割対象のコンテナ(幅の基準) */
  container: HTMLElement
  /** ドラッグ対象のハンドル */
  handle: HTMLElement
  /** ドラッグ中に呼ばれる(描画の更新用) */
  onChange: (ratio: number) => void
  /** ドラッグ完了時・キー操作時に呼ばれる(永続化用) */
  onCommit: (ratio: number) => void
}

export interface SplitterController {
  getRatio(): number
  setRatio(ratio: number): void
  destroy(): void
}

/**
 * スプリッターのドラッグ操作を設定する。
 * Pointer Events + setPointerCapture により、ペイン外へポインタが出ても追従する。
 */
export function createSplitter({
  container,
  handle,
  onChange,
  onCommit,
}: SplitterOptions): SplitterController {
  let ratio = DEFAULT_RATIO

  const apply = (next: number): void => {
    ratio = clampRatio(next)
    // role="separator" のフォーカス可能な要素は現在値を公開する必要がある
    handle.setAttribute('aria-valuenow', String(Math.round(ratio * 100)))
    onChange(ratio)
  }

  const handlePointerMove = (event: PointerEvent): void => {
    apply(ratioFromPointer(event.clientX, container.getBoundingClientRect()))
  }

  /** ドラッグ用のリスナと表示状態を元に戻す。何度呼んでも安全。 */
  const endDrag = (): void => {
    handle.removeEventListener('pointermove', handlePointerMove)
    handle.removeEventListener('pointerup', stopDragging)
    handle.removeEventListener('pointercancel', stopDragging)
    document.body.classList.remove('is-dragging')
  }

  const stopDragging = (event: PointerEvent): void => {
    // pointercancel 後はポインタが非アクティブになり、releasePointerCapture は
    // NotFoundError を投げる。後片付けが飛ばないよう捕捉中か確認してから解除する。
    if (handle.hasPointerCapture?.(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId)
    }
    endDrag()
    onCommit(ratio)
  }

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    event.preventDefault()
    try {
      handle.setPointerCapture?.(event.pointerId)
    } catch {
      // キャプチャできなくてもハンドル上のドラッグは成立するため続行する
    }
    handle.addEventListener('pointermove', handlePointerMove)
    handle.addEventListener('pointerup', stopDragging)
    handle.addEventListener('pointercancel', stopDragging)
    document.body.classList.add('is-dragging')
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    const delta =
      event.key === 'ArrowLeft' ? -KEY_STEP : event.key === 'ArrowRight' ? KEY_STEP : null
    if (delta === null) return
    event.preventDefault()
    apply(ratio + delta)
    onCommit(ratio)
  }

  // ARIA の上下限は TypeScript 側の定数を唯一の出所とする(HTML との二重管理を避ける)
  handle.setAttribute('aria-valuemin', String(Math.round(MIN_RATIO * 100)))
  handle.setAttribute('aria-valuemax', String(Math.round(MAX_RATIO * 100)))
  handle.setAttribute('aria-valuenow', String(Math.round(ratio * 100)))

  handle.addEventListener('pointerdown', handlePointerDown)
  handle.addEventListener('keydown', handleKeyDown)

  return {
    getRatio: () => ratio,
    setRatio: (next: number) => apply(next),
    destroy: () => {
      // ドラッグ中に破棄されても追従し続けないよう、進行中の操作も終了させる
      endDrag()
      handle.removeEventListener('pointerdown', handlePointerDown)
      handle.removeEventListener('keydown', handleKeyDown)
    },
  }
}
