export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
export const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

/** viewBox も width/height も読めなかった場合のフォールバックサイズ。 */
export const FALLBACK_SIZE = { width: 800, height: 600 } as const

export type PngScale = 1 | 2 | 3
export type PngBackground = 'transparent' | 'white'

export interface Size {
  width: number
  height: number
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

/** `YYYYMMDD-HHmmss` 形式のタイムスタンプ(ローカル時刻)。 */
export function formatTimestamp(date: Date): string {
  const ymd = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const hms = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${ymd}-${hms}`
}

/** `diagram-YYYYMMDD-HHmmss.<ext>` 形式のファイル名。 */
export function buildFileName(extension: 'svg' | 'png', date: Date): string {
  return `diagram-${formatTimestamp(date)}.${extension}`
}

function parseLength(value: string | null): number | null {
  if (!value) return null
  const matched = /^\s*(-?[\d.]+)\s*(px)?\s*$/i.exec(value)
  if (!matched?.[1]) return null
  const parsed = Number(matched[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseSvgElement(svgText: string): SVGElement {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.nodeName === 'parsererror' || root.getElementsByTagName('parsererror').length) {
    throw new Error('SVG を解析できませんでした')
  }
  return root as unknown as SVGElement
}

function sizeOf(root: Element): Size {
  const viewBox = root.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    const width = parts[2]
    const height = parts[3]
    if (
      parts.length === 4 &&
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      (width as number) > 0 &&
      (height as number) > 0
    ) {
      return { width: width as number, height: height as number }
    }
  }

  const width = parseLength(root.getAttribute('width'))
  const height = parseLength(root.getAttribute('height'))
  if (width !== null && height !== null) return { width, height }

  return { ...FALLBACK_SIZE }
}

/** SVG の論理サイズ(viewBox 優先)を返す。 */
export function parseSvgSize(svgText: string): Size {
  return sizeOf(parseSvgElement(svgText))
}

export interface ResizedSvg extends Size {
  markup: string
}

/**
 * SVG に明示的な px サイズを与える。
 *
 * mermaid の出力は `width="100%"` と `style="max-width: ...px"` を持つため、
 * そのままではプレビューでも Canvas 変換でも意図した大きさにならない。
 * viewBox を保ったまま width/height を実寸に置き換え、max-width を取り除く。
 */
export function resizeSvg(svgText: string, scale = 1): ResizedSvg {
  const root = parseSvgElement(svgText)
  const base = sizeOf(root)
  const width = Math.max(1, Math.round(base.width * scale))
  const height = Math.max(1, Math.round(base.height * scale))

  if (!root.getAttribute('viewBox')) {
    root.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`)
  }
  root.setAttribute('xmlns', SVG_NAMESPACE)
  if (!root.getAttribute('xmlns:xlink')) {
    root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', XLINK_NAMESPACE)
  }
  root.setAttribute('width', String(width))
  root.setAttribute('height', String(height))

  const style = root.getAttribute('style')
  if (style) {
    const cleaned = style
      .split(';')
      .filter((rule) => rule.trim().length > 0 && !/^\s*max-width\s*:/i.test(rule))
      .join(';')
    if (cleaned) {
      root.setAttribute('style', cleaned)
    } else {
      root.removeAttribute('style')
    }
  }

  return { markup: new XMLSerializer().serializeToString(root), width, height }
}

/** SVG 文字列を <img> で読み込める data URL に変換する。 */
export function toSvgDataUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('SVG を画像として読み込めませんでした'))
    image.src = src
  })
}

export interface PngOptions {
  scale: PngScale
  background: PngBackground
}

/** SVG を Canvas 経由でラスタライズして PNG の Blob を返す。 */
export async function svgToPngBlob(svgText: string, options: PngOptions): Promise<Blob> {
  const { markup, width, height } = resizeSvg(svgText, options.scale)
  const image = await loadImage(toSvgDataUrl(markup))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas コンテキストを取得できませんでした')

  if (options.background === 'white') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(image, 0, 0, width, height)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG への変換に失敗しました'))
    }, 'image/png')
  })
}

/** SVG 文字列をそのまま保存用の Blob にする。 */
export function svgToBlob(svgText: string): Blob {
  return new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
}

/** Blob をファイルとしてダウンロードさせる。 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
