import './style.css'
import { createEditor } from './editor'
import {
  buildFileName,
  downloadBlob,
  resizeSvg,
  svgToBlob,
  svgToPngBlob,
  type PngBackground,
  type PngScale,
  type Size,
} from './exporter'
import {
  clampZoom,
  debounce,
  RENDER_DEBOUNCE_MS,
  renderDiagram,
  SAVE_DEBOUNCE_MS,
  stepZoom,
} from './preview'
import { clampRatio, createSplitter, DEFAULT_RATIO } from './splitter'
import {
  loadDocumentOrSample,
  loadSplitRatio,
  saveDocument,
  saveSplitRatio,
  type SaveResult,
} from './storage'

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`要素が見つかりません: #${id}`)
  return element as T
}

const editorPane = requireElement('editor-pane')
const previewPane = requireElement('preview-pane')
const previewStage = requireElement('preview-stage')
const panes = requireElement('panes')
const splitterHandle = requireElement('splitter')
const statusError = requireElement('status-error')
const statusSave = requireElement('status-save')
const scaleSelect = requireElement<HTMLSelectElement>('png-scale')
const backgroundSelect = requireElement<HTMLSelectElement>('png-background')
const zoomValue = requireElement('zoom-value')

/** 直近に描画に成功した SVG(mermaid の出力そのまま)。構文エラー時も保持する。 */
let lastValidSvg: string | null = null
let naturalSize: Size = { width: 0, height: 0 }
let zoom = 1

// ---------------------------------------------------------------- ステータスバー

function showError(message: string | null): void {
  statusError.textContent = message ?? ''
}

function showSaveState(message: string, tone: 'normal' | 'warning' = 'normal'): void {
  statusSave.textContent = message
  statusSave.classList.toggle('is-warning', tone === 'warning')
}

function reportSaveResult(result: SaveResult): void {
  if (result.ok) {
    showSaveState('保存しました')
  } else {
    showSaveState(result.message, 'warning')
  }
}

// ---------------------------------------------------------------- プレビュー

function applyZoom(): void {
  zoomValue.textContent = `${Math.round(zoom * 100)}%`
  const svg = previewStage.querySelector('svg')
  if (!svg || naturalSize.width === 0) return
  svg.setAttribute('width', String(Math.round(naturalSize.width * zoom)))
  svg.setAttribute('height', String(Math.round(naturalSize.height * zoom)))
}

function setZoom(next: number): void {
  zoom = clampZoom(next)
  applyZoom()
}

function paint(svgText: string): void {
  // mermaid の出力は width="100%" / max-width を持つため、実寸に正規化してから差し込む
  const resized = resizeSvg(svgText)
  naturalSize = { width: resized.width, height: resized.height }
  previewStage.innerHTML = resized.markup
  applyZoom()
}

/** 最後に開始したレンダリングの識別子。古い結果の取り込みを防ぐために使う。 */
let renderToken = 0

async function render(code: string): Promise<void> {
  const token = ++renderToken
  const result = await renderDiagram(code)

  // レンダリング時間は図の規模で大きく変わるため、先に開始した処理が後から
  // 完了しうる。古い結果で新しい表示を上書きしないよう破棄する。
  if (token !== renderToken) return

  if (result.ok) {
    lastValidSvg = result.svg
    showError(null)
    paint(result.svg)
    return
  }
  // 構文エラー時は直前の正常な図を表示し続ける
  showError(result.message)
}

const renderLater = debounce((code: string) => {
  void render(code)
}, RENDER_DEBOUNCE_MS)

const saveLater = debounce((code: string) => {
  reportSaveResult(saveDocument(code))
}, SAVE_DEBOUNCE_MS)

// ---------------------------------------------------------------- エディタ

const initialDocument = loadDocumentOrSample()

createEditor({
  parent: editorPane,
  doc: initialDocument,
  onChange: (value) => {
    showSaveState('編集中…')
    renderLater(value)
    saveLater(value)
  },
})

void render(initialDocument)

// 保存の debounce は 1 秒あるため、直後にタブを閉じると最後の編集が失われる。
// bfcache でも確実に発火する pagehide で保留分を書き出す。
window.addEventListener('pagehide', () => {
  saveLater.flush()
})

// ---------------------------------------------------------------- 分割比率

function applyRatio(ratio: number): void {
  editorPane.style.flexBasis = `${ratio * 100}%`
}

const splitter = createSplitter({
  container: panes,
  handle: splitterHandle,
  onChange: applyRatio,
  onCommit: (ratio) => {
    const result = saveSplitRatio(ratio)
    if (!result.ok) showSaveState(result.message, 'warning')
  },
})

splitter.setRatio(clampRatio(loadSplitRatio() ?? DEFAULT_RATIO))

// ---------------------------------------------------------------- ズーム

requireElement('zoom-in').addEventListener('click', () => setZoom(stepZoom(zoom, 1)))
requireElement('zoom-out').addEventListener('click', () => setZoom(stepZoom(zoom, -1)))
requireElement('zoom-reset').addEventListener('click', () => setZoom(1))

previewPane.addEventListener(
  'wheel',
  (event) => {
    // Cmd(macOS)/Ctrl(ピンチ操作)押下時のみズーム。通常のスクロールは妨げない
    if (!event.metaKey && !event.ctrlKey) return
    // 横スクロール(deltaY === 0)ではズームしない
    if (event.deltaY === 0) return
    event.preventDefault()
    setZoom(stepZoom(zoom, event.deltaY > 0 ? -1 : 1))
  },
  { passive: false },
)

// ---------------------------------------------------------------- エクスポート

function currentScale(): PngScale {
  const value = Number(scaleSelect.value)
  return (value === 1 || value === 2 || value === 3 ? value : 2) as PngScale
}

function currentBackground(): PngBackground {
  return backgroundSelect.value === 'white' ? 'white' : 'transparent'
}

requireElement('export-svg').addEventListener('click', () => {
  if (!lastValidSvg) {
    showError('出力できる図がありません')
    return
  }
  try {
    downloadBlob(svgToBlob(lastValidSvg), buildFileName('svg', new Date()))
  } catch (error) {
    showError(error instanceof Error ? error.message : 'SVG の出力に失敗しました')
  }
})

requireElement('export-png').addEventListener('click', () => {
  if (!lastValidSvg) {
    showError('出力できる図がありません')
    return
  }
  void (async () => {
    try {
      const blob = await svgToPngBlob(lastValidSvg, {
        scale: currentScale(),
        background: currentBackground(),
      })
      downloadBlob(blob, buildFileName('png', new Date()))
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      showError(`PNG 変換に失敗しました(${detail})。SVG 出力をお試しください`)
    }
  })()
})
