export const DOCUMENT_KEY = 'mermaid-editor:document'
export const SPLIT_RATIO_KEY = 'mermaid-editor:split-ratio'

/** 初回起動時に表示するサンプル図。 */
export const SAMPLE_DOCUMENT = `flowchart TD
  A[Mermaid を書く] --> B{構文は正しい?}
  B -- Yes --> C[プレビューに反映]
  B -- No --> D[ステータスバーにエラー]
  D --> A
  C --> E[SVG / PNG で出力]
`

/** localStorage のうち本アプリが使う最小限のインターフェイス(テスト用に差し替え可能)。 */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'unavailable'; message: string }

/**
 * localStorage を取得する。プライベートモード等で参照自体が例外になる環境を考慮して try で包む。
 */
export function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * 容量超過の例外かどうかを判定する。
 * 名前とコードはブラウザごとに異なり、DOMException が Error を継承しない実行環境もあるため、
 * instanceof ではなくプロパティで判定する。
 */
export function isQuotaExceeded(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { name, code } = error as { name?: unknown; code?: unknown }
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  )
}

function write(key: string, value: string, storage: StorageLike | null): SaveResult {
  if (!storage) {
    return { ok: false, reason: 'unavailable', message: 'localStorage を利用できません' }
  }
  try {
    storage.setItem(key, value)
    return { ok: true }
  } catch (error) {
    if (isQuotaExceeded(error)) {
      return {
        ok: false,
        reason: 'quota',
        message: 'localStorage の容量を超えたため保存をスキップしました',
      }
    }
    return { ok: false, reason: 'unavailable', message: 'localStorage に保存できませんでした' }
  }
}

function read(key: string, storage: StorageLike | null): string | null {
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function saveDocument(text: string, storage = defaultStorage()): SaveResult {
  return write(DOCUMENT_KEY, text, storage)
}

/** 保存済みドキュメントを返す。未保存(初回起動)の場合は null。 */
export function loadDocument(storage = defaultStorage()): string | null {
  return read(DOCUMENT_KEY, storage)
}

/** 保存済みドキュメント、なければサンプル図を返す。 */
export function loadDocumentOrSample(storage = defaultStorage()): string {
  return loadDocument(storage) ?? SAMPLE_DOCUMENT
}

export function saveSplitRatio(ratio: number, storage = defaultStorage()): SaveResult {
  return write(SPLIT_RATIO_KEY, String(ratio), storage)
}

/** 保存済みの分割比率を返す。未保存や不正値の場合は null。 */
export function loadSplitRatio(storage = defaultStorage()): number | null {
  const raw = read(SPLIT_RATIO_KEY, storage)
  if (raw === null) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0 || value >= 1) return null
  return value
}
