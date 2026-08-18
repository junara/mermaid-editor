// vite.config.ts の define で置換される。ここを変えるときは define 側も合わせること
declare const __APP_VERSION__: string
declare const __APP_BUILD_TIME__: string

/** package.json の version。 */
export const APP_VERSION = __APP_VERSION__
/** ビルド時刻(ISO 8601)。 */
export const APP_BUILD_TIME = __APP_BUILD_TIME__

/** ISO 8601 をローカル時刻の「YYYY-MM-DD HH:mm」にする。読めない値なら null。 */
function formatTimestamp(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * ステータスバーに出す版の表記を作る。
 * version はデプロイのたびには上がらず、それだけでは PWA が掴んでいる版が古いかどうかを
 * 判断できないため、ビルド日時を併記する。
 */
export function formatVersionLabel(version: string, buildTime: string): string {
  const stamp = formatTimestamp(buildTime)
  return stamp === null ? `v${version}` : `v${version} (${stamp})`
}

/** 版の表記に添えるツールチップ。表示が何の数字なのかを補う。 */
export function formatVersionTitle(version: string, buildTime: string): string {
  const stamp = formatTimestamp(buildTime)
  return `バージョン ${version} / ビルド日時 ${stamp ?? '不明'}`
}
