import mermaid from 'mermaid'

/**
 * Canvas でのラスタライズ時に解決できる書体のみを使う。
 * Web フォントは <img> 経由の SVG では読み込まれないため、システムフォントに限定する。
 */
export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'

/** 入力停止からレンダリングまでの待ち時間(ms)。 */
export const RENDER_DEBOUNCE_MS = 300
/** 入力停止から localStorage 保存までの待ち時間(ms)。 */
export const SAVE_DEBOUNCE_MS = 1000

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 2
export const ZOOM_STEP = 0.1

export type RenderResult = { ok: true; svg: string } | { ok: false; message: string }

let initialized = false

/**
 * mermaid を初期化する(冪等)。
 * htmlLabels を false にするのは、foreignObject 内の HTML が Canvas 変換時に描画されないため。
 */
export function initMermaid(): void {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'strict',
    fontFamily: SYSTEM_FONT_STACK,
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  })
  initialized = true
}

function findLineNumber(error: unknown, raw: string): number | null {
  const hash = (error as { hash?: { line?: unknown } } | null)?.hash
  if (hash && typeof hash.line === 'number' && Number.isFinite(hash.line)) {
    return hash.line
  }
  const matched = /line\s+(\d+)/i.exec(raw)
  return matched?.[1] ? Number(matched[1]) : null
}

/**
 * 例外オブジェクトから元メッセージを取り出す。
 * 素の String() ではプレーンオブジェクトが `[object Object]` になり、
 * ステータスバーに意味のない文字列が出てしまうため、型ごとに扱いを分ける。
 */
function toRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'number' || typeof error === 'boolean') return String(error)
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' ? message : ''
}

/**
 * mermaid が投げたエラーから、ステータスバーに出す 1 行のメッセージを組み立てる。
 * 行番号が取得できる場合は付記する。
 */
export function extractErrorMessage(error: unknown): string {
  const raw = toRawMessage(error)
  const head = raw
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!head) return '構文エラー'

  const line = findLineNumber(error, raw)
  if (line !== null && !/line\s+\d+/i.test(head)) {
    return `${head} (${line} 行目)`
  }
  return head
}

let renderCount = 0

/**
 * Mermaid テキストを SVG にレンダリングする。
 * 失敗しても例外は投げず、メッセージを含む結果を返す。
 */
export async function renderDiagram(code: string): Promise<RenderResult> {
  if (code.trim().length === 0) {
    return { ok: false, message: '入力が空です' }
  }

  initMermaid()
  const id = `mermaid-render-${renderCount++}`

  try {
    const { svg } = await mermaid.render(id, code)
    return { ok: true, svg }
  } catch (error) {
    return { ok: false, message: extractErrorMessage(error) }
  } finally {
    // レンダリング失敗時、mermaid が計測用の一時要素を残すことがあるため掃除する
    document.getElementById(id)?.remove()
    document.getElementById(`d${id}`)?.remove()
  }
}

export interface Debounced<A extends unknown[]> {
  (...args: A): void
  cancel(): void
}

/** 最後の呼び出しから wait ms 経過後に fn を 1 回だけ実行する。 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const wrapped = (...args: A): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      fn(...args)
    }, wait)
  }

  wrapped.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  return wrapped
}

/** ズーム倍率を許容範囲に収める。 */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
  // 0.1 刻みの浮動小数誤差を丸める
  return Math.round(clamped * 100) / 100
}

/** ズームを 1 段階変更する(direction: +1 拡大 / -1 縮小)。 */
export function stepZoom(zoom: number, direction: number): number {
  return clampZoom(zoom + Math.sign(direction) * ZOOM_STEP)
}
