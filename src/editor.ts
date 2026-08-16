import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import {
  flowchartTags,
  mermaid as mermaidLanguage,
  mermaidTags,
  mindmapTags,
  pieTags,
  sequenceTags,
} from 'codemirror-lang-mermaid'

/** インデント幅(スペース 2)。 */
export const INDENT_UNIT = '  '

const palette = {
  diagram: '#0b7285',
  keyword: '#5f3dc4',
  comment: '#868e96',
  string: '#0b7a3e',
  number: '#a15c07',
  node: '#1864ab',
  text: '#212529',
  edge: '#c2255c',
  link: '#1c7ed6',
}

/**
 * codemirror-lang-mermaid は独自の Tag を使うため、既定のハイライトスタイルでは着色されない。
 * 図種別ごとの Tag を明示的にマッピングする。
 */
const mermaidHighlightStyle = HighlightStyle.define([
  { tag: mermaidTags.diagramName, color: palette.diagram, fontWeight: 'bold' },

  { tag: flowchartTags.diagramName, color: palette.diagram, fontWeight: 'bold' },
  { tag: flowchartTags.keyword, color: palette.keyword, fontWeight: 'bold' },
  { tag: flowchartTags.orientation, color: palette.keyword },
  { tag: flowchartTags.lineComment, color: palette.comment, fontStyle: 'italic' },
  { tag: flowchartTags.string, color: palette.string },
  { tag: flowchartTags.number, color: palette.number },
  { tag: flowchartTags.nodeId, color: palette.node, fontWeight: 'bold' },
  { tag: flowchartTags.nodeText, color: palette.text },
  { tag: flowchartTags.nodeEdge, color: palette.edge },
  { tag: flowchartTags.nodeEdgeText, color: palette.edge },
  { tag: flowchartTags.link, color: palette.link, textDecoration: 'underline' },

  { tag: sequenceTags.diagramName, color: palette.diagram, fontWeight: 'bold' },
  { tag: sequenceTags.keyword1, color: palette.keyword, fontWeight: 'bold' },
  { tag: sequenceTags.keyword2, color: palette.keyword },
  { tag: sequenceTags.arrow, color: palette.edge },
  { tag: sequenceTags.position, color: palette.node },
  { tag: sequenceTags.nodeText, color: palette.node, fontWeight: 'bold' },
  { tag: sequenceTags.messageText1, color: palette.text },
  { tag: sequenceTags.messageText2, color: palette.text },
  { tag: sequenceTags.lineComment, color: palette.comment, fontStyle: 'italic' },

  { tag: pieTags.diagramName, color: palette.diagram, fontWeight: 'bold' },
  { tag: pieTags.title, color: palette.keyword, fontWeight: 'bold' },
  { tag: pieTags.titleText, color: palette.text },
  { tag: pieTags.showData, color: palette.keyword },
  { tag: pieTags.string, color: palette.string },
  { tag: pieTags.number, color: palette.number },
  { tag: pieTags.lineComment, color: palette.comment, fontStyle: 'italic' },

  { tag: mindmapTags.diagramName, color: palette.diagram, fontWeight: 'bold' },
  { tag: mindmapTags.lineText1, color: palette.node, fontWeight: 'bold' },
  { tag: mindmapTags.lineText2, color: palette.text },
  { tag: mindmapTags.lineText3, color: palette.text },
  { tag: mindmapTags.lineText4, color: palette.text },
  { tag: mindmapTags.lineText5, color: palette.text },
])

const editorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '13px',
      backgroundColor: '#ffffff',
      color: palette.text,
    },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      lineHeight: '1.6',
      overflow: 'auto',
    },
    '.cm-content': { padding: '12px 0' },
    '.cm-gutters': {
      backgroundColor: '#fafafa',
      color: '#adb5bd',
      border: 'none',
      borderRight: '1px solid #e9ecef',
    },
    '.cm-activeLine': { backgroundColor: '#f8f9fa' },
    '.cm-activeLineGutter': { backgroundColor: '#f1f3f5', color: '#495057' },
  },
  { dark: false },
)

export interface CreateEditorOptions {
  /** エディタを描画する親要素 */
  parent: HTMLElement
  /** 初期テキスト */
  doc: string
  /** テキスト変更時のコールバック(ユーザー操作・プログラム変更のいずれでも呼ばれる) */
  onChange: (value: string) => void
}

/**
 * Mermaid 用の CodeMirror 6 エディタを生成する。
 * 補完・スニペットはスコープ外のため、拡張は明示的に列挙して basicSetup を使わない。
 */
export function createEditor({ parent, doc, onChange }: CreateEditorOptions): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      indentUnit.of(INDENT_UNIT),
      EditorState.tabSize.of(INDENT_UNIT.length),
      EditorState.allowMultipleSelections.of(true),
      EditorView.lineWrapping,
      // indentWithTab は既定キーマップより先に置き、Tab をインデントに割り当てる
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      mermaidLanguage(),
      syntaxHighlighting(mermaidHighlightStyle),
      editorTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
    ],
  })

  return new EditorView({ state, parent })
}
