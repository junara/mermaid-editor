import { describe, expect, it } from 'vitest'

import {
  buildFileName,
  FALLBACK_SIZE,
  formatTimestamp,
  parseSvgSize,
  resizeSvg,
  svgToBlob,
  toSvgDataUrl,
} from '../exporter'

/** mermaid が実際に出力する形に近い SVG。 */
const MERMAID_SVG =
  '<svg aria-roledescription="flowchart-v2" role="graphics-document document" ' +
  'viewBox="0 0 320 180" style="max-width: 320px; background-color: white;" ' +
  'xmlns="http://www.w3.org/2000/svg" width="100%" id="mermaid-render-0">' +
  '<g><text>hello</text></g></svg>'

describe('formatTimestamp', () => {
  it('YYYYMMDD-HHmmss 形式にゼロ埋めする', () => {
    expect(formatTimestamp(new Date(2026, 0, 5, 9, 7, 3))).toBe('20260105-090703')
  })

  it('2 桁の値をそのまま並べる', () => {
    expect(formatTimestamp(new Date(2026, 11, 31, 23, 59, 59))).toBe('20261231-235959')
  })
})

describe('buildFileName', () => {
  it('拡張子ごとに diagram-<timestamp>.<ext> を返す', () => {
    const date = new Date(2026, 7, 16, 20, 10, 0)
    expect(buildFileName('svg', date)).toBe('diagram-20260816-201000.svg')
    expect(buildFileName('png', date)).toBe('diagram-20260816-201000.png')
  })
})

describe('parseSvgSize', () => {
  it('viewBox を優先して論理サイズを返す', () => {
    expect(parseSvgSize(MERMAID_SVG)).toEqual({ width: 320, height: 180 })
  })

  it('viewBox がなければ width/height 属性を使う', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200px" height="100px"></svg>'
    expect(parseSvgSize(svg)).toEqual({ width: 200, height: 100 })
  })

  it('カンマ区切りの viewBox も解釈する', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0,0,50,25"></svg>'
    expect(parseSvgSize(svg)).toEqual({ width: 50, height: 25 })
  })

  it('サイズを判定できない場合はフォールバックする', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100%"></svg>'
    expect(parseSvgSize(svg)).toEqual(FALLBACK_SIZE)
  })

  it('解析できない入力では例外を投げる', () => {
    expect(() => parseSvgSize('<svg><g></svg>')).toThrow('SVG を解析できませんでした')
  })
})

describe('resizeSvg', () => {
  it('scale を掛けた実寸を width/height に設定する', () => {
    const result = resizeSvg(MERMAID_SVG, 2)
    expect(result.width).toBe(640)
    expect(result.height).toBe(360)
    expect(result.markup).toContain('width="640"')
    expect(result.markup).toContain('height="360"')
  })

  it('viewBox は保持する', () => {
    expect(resizeSvg(MERMAID_SVG, 3).markup).toContain('viewBox="0 0 320 180"')
  })

  it('max-width だけを style から取り除く', () => {
    const markup = resizeSvg(MERMAID_SVG).markup
    expect(markup).not.toContain('max-width')
    expect(markup).toContain('background-color: white')
  })

  it('style が max-width のみの場合は属性ごと削除する', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" style="max-width: 10px;"></svg>'
    expect(resizeSvg(svg).markup).not.toContain('style=')
  })

  it('既定の scale は 1 で、論理サイズをそのまま使う', () => {
    const result = resizeSvg(MERMAID_SVG)
    expect([result.width, result.height]).toEqual([320, 180])
  })

  it('viewBox がなければ width/height から補う', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"></svg>'
    expect(resizeSvg(svg, 2).markup).toContain('viewBox="0 0 40 20"')
  })

  it('端数は丸め、最小 1px を保証する', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 3"></svg>'
    const result = resizeSvg(svg, 1)
    expect(result.width).toBe(3)
    expect(resizeSvg(svg, 0.01).width).toBe(1)
  })

  it('xmlns を必ず含める', () => {
    expect(resizeSvg(MERMAID_SVG).markup).toContain('http://www.w3.org/2000/svg')
  })
})

describe('toSvgDataUrl', () => {
  it('URL エンコードした data URL を返す', () => {
    const url = toSvgDataUrl('<svg><text>a b</text></svg>')
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(url).not.toContain(' ')
    expect(decodeURIComponent(url.split(',')[1] as string)).toBe('<svg><text>a b</text></svg>')
  })
})

describe('svgToBlob', () => {
  it('image/svg+xml の Blob を返す', () => {
    const blob = svgToBlob(MERMAID_SVG)
    expect(blob.type).toBe('image/svg+xml;charset=utf-8')
    expect(blob.size).toBeGreaterThan(0)
  })
})
