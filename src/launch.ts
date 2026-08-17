import { SAMPLE_DOCUMENT } from './storage'

/** share_target(GET)でテキストを受け取るクエリパラメータ名。manifest の宣言と一致させる。 */
const SHARE_TEXT_PARAM = 'text'

/**
 * 共有メニューから渡されたテキストを取り出す。指定がなければ null。
 * 正規化と空判定は取り込み側(normalizeIncomingText)に任せ、ここでは加工しない。
 */
export function parseSharedText(search: string): string | null {
  return new URLSearchParams(search).get(SHARE_TEXT_PARAM)
}

/**
 * 外部から受け取ったテキストをエディタに取り込める形に整える。
 * 改行コードを LF に揃え、前後の空白を落とす(trim は BOM も空白として除去する)。
 */
export function normalizeIncomingText(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim()
}

/**
 * 現在の内容を置き換える前に確認が必要かを判定する。
 * localStorage は 1 文書しか持たないため置き換えは破壊的だが、
 * 未編集(空、または初回サンプルのまま)なら失うものがないので確認しない。
 */
export function needsReplaceConfirmation(current: string): boolean {
  const trimmed = current.trim()
  return trimmed !== '' && trimmed !== SAMPLE_DOCUMENT.trim()
}

/** launchQueue が渡すファイルハンドルのうち、本アプリが使う部分だけを表す。 */
interface LaunchFile {
  getFile: () => Promise<File>
}

interface LaunchParams {
  files: readonly LaunchFile[]
}

interface LaunchQueue {
  setConsumer: (consumer: (params: LaunchParams) => void) => void
}

export interface ConsumeLaunchFilesOptions {
  /** 読み込んだファイルの内容(未正規化) */
  onText: (text: string) => void
  onError: (message: string) => void
}

/**
 * file_handlers 経由で開かれたファイルを受け取る。
 * launchQueue 未対応のブラウザでは何もしない。
 */
export function consumeLaunchFiles({ onText, onError }: ConsumeLaunchFilesOptions): void {
  const queue = (globalThis as typeof globalThis & { launchQueue?: LaunchQueue }).launchQueue
  if (!queue) return

  queue.setConsumer((params) => {
    // エディタは 1 文書しか保持しないため、複数渡された場合も先頭だけを開く
    const handle = params.files[0]
    if (!handle) return
    void (async () => {
      try {
        const file = await handle.getFile()
        onText(await file.text())
      } catch {
        onError('ファイルを読み込めませんでした')
      }
    })()
  })
}
