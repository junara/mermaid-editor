# PWA 化 仕様

本エディタを PWA (Progressive Web App) 化し、オフライン動作・インストール・OS 連携を提供する。

本アプリはサーバー API を持たず、描画も保存もブラウザ内で完結しているため、
ネットワークが必要なのは初回のアセット取得のみである。この性質を前提に仕様を定める。

## 決定事項

| #   | 項目             | 決定                                                                     |
| --- | ---------------- | ------------------------------------------------------------------------ |
| 1   | オフライン範囲   | 全アセット(約 4MB)を precache し、全図種をオフラインで描画可能にする     |
| 2   | 更新フロー       | 新版検知でステータスバーに通知し、クリックで適用する(自動リロードしない) |
| 3   | OS 連携          | `.mmd` / `.mermaid` の関連付け + 共有メニューへの登録                    |
| 4   | 保存モデル       | localStorage のみ。開いたファイルへの書き戻しはしない                    |
| 5   | 受け取り時の挙動 | 確認してから現在の編集内容を置き換える                                   |
| 6   | アイコン         | フローチャート風のアイコンを新規作成する                                 |
| 7   | データ保全       | 追加対応なし(現状の localStorage 自動保存のまま)                         |
| 8   | 共有受信         | GET クエリ(`?text=`)。Service Worker は自動生成のまま                    |

## 1. オフライン

mermaid は図種ごとに JS チャンクを遅延ロードするため、コアのみのキャッシュでは
「オフラインで gantt を書いた瞬間に描画が失敗する」状態になる。これを避けるため、
ビルド成果物すべてを precache 対象とする。

- インストール時に約 4MB を一括ダウンロードする。これは一度きりのコストとして許容する。
- 生成戦略は `vite-plugin-pwa` の `generateSW`(Workbox 自動生成)を使う。
- ナビゲーションリクエストは precache した `index.html` にフォールバックさせる。

## 2. 更新フロー

Service Worker は放置すると古い版を掴み続けるため、明示的な更新導線を設ける。

- `registerType: 'prompt'` を使い、新しい Service Worker が waiting 状態になったら通知する。
- ステータスバーに「更新があります / 再読み込み」を表示し、クリックで `skipWaiting` してリロードする。
- 編集中に勝手にリロードしない。CodeMirror の undo 履歴とカーソル位置を保護するため。
- 更新を適用するまで古い版を掴み続けるため、ステータスバーに動作中の版を常時表示する。
  `package.json` の version はデプロイのたびには上がらないので、ビルド日時を併記して見分ける
  (`vite.config.ts` の `define` で埋め込み、`src/version.ts` で整形する)。

## 3. OS 連携

### ファイル関連付け

manifest の `file_handlers` で `.mmd` / `.mermaid` を関連付ける。
起動時に `launchQueue.setConsumer` でファイルハンドルを受け取り、内容を読んでエディタに反映する。

- 対応: デスクトップ版 Chrome / Edge のみ。

### 共有メニュー

manifest の `share_target` を `method: "GET"` で宣言し、`?text=` に共有テキストを受け取る。
起動時に `location.search` を読んで反映する。

- 対応: 実質 Android Chrome のみ。
- POST 方式なら長さ制限がないが、Service Worker を自前で書く(`injectManifest`)必要が生じるため採らない。
- 極端に長い図は URL 長の制限で切れる可能性がある。これは許容する。

## 4. 保存モデル

開いたファイルは内容を取り込むだけで、元ファイルには書き戻さない。
保存先は従来どおり localStorage の 1 文書のみで、`storage.ts` の構造は変更しない。

File System Access API によるハンドル保持・上書き保存は、権限要求・ダーティ状態管理・
未保存警告が必要になり実装量が段違いに増えるため、本対応の範囲外とする。

## 5. 受け取り時の挙動

localStorage は 1 文書しか持たないため、ファイルや共有テキストを受け取ると既存の編集内容が失われる。
そのため置き換え前に確認する。

- `window.confirm` で確認する(既存にモーダル UI がないため)。
- ただし現在の内容が初期サンプルのまま未編集の場合は、失うものがないので確認を省略して即座に開く。
- 確認をキャンセルした場合は現在の内容を維持し、受け取った内容は破棄する。

## 6. アイコン

ノードと矢印を模したフローチャート風のアイコンを SVG で作成し、そこから PNG を書き出す(`make icons`)。
原本のうち `public/favicon.svg` は配信もされる資産、`icons/icon-maskable.svg` は生成用のみで配信しない。

| ファイル                       | 用途                                         |
| ------------------------------ | -------------------------------------------- |
| `public/favicon.svg`           | ブラウザタブ                                 |
| `public/icon-192.png`          | manifest 標準アイコン                        |
| `public/icon-512.png`          | manifest 標準アイコン / スプラッシュ         |
| `public/icon-maskable-512.png` | Android のマスク適用用(安全領域に余白を確保) |
| `public/apple-touch-icon.png`  | iOS ホーム画面(180px、透過なし)              |

## 7. manifest

既存のスタイルトークン(`--color-accent: #1c7ed6`、`--color-bg: #ffffff`)に揃える。

| キー               | 値                                                                        |
| ------------------ | ------------------------------------------------------------------------- |
| `name`             | `Mermaid エディタ`                                                        |
| `short_name`       | `Mermaid`                                                                 |
| `description`      | Mermaid テキストを編集し、プレビューして SVG / PNG として出力するエディタ |
| `lang`             | `ja`                                                                      |
| `display`          | `standalone`                                                              |
| `theme_color`      | `#ffffff`                                                                 |
| `background_color` | `#ffffff`                                                                 |
| `start_url`        | `/`                                                                       |
| `scope`            | `/`                                                                       |
| `id`               | `/`(将来 `start_url` を変えても別アプリ扱いにならないよう明示する)        |

## 実装範囲

| ファイル                       | 内容                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| `vite.config.ts`               | VitePWA 設定(manifest、`file_handlers`、`share_target`、precache 対象) |
| `package.json`                 | `vite-plugin-pwa` を devDependencies に追加                            |
| `public/`                      | アイコン一式と favicon を新規作成                                      |
| `index.html`                   | favicon 参照、ステータスバーに更新通知の要素を追加                     |
| `src/launch.ts`                | 新規。起動時入力の解決と確認要否の判定                                 |
| `src/pwa.ts`                   | 新規。Service Worker 登録と更新通知の配線                              |
| `src/main.ts`                  | 上記の配線                                                             |
| `src/style.css`                | 更新通知ボタンのスタイル                                               |
| `src/__tests__/launch.test.ts` | 新規                                                                   |
| `Makefile`                     | `preview`(PWA の動作確認)と `icons`(PNG 書き出し)を追加                |
| `README.md`                    | インストール手順とオフライン動作の記載                                 |

## 仕様上の制限

- `.mmd` 関連付けはデスクトップ版 Chrome / Edge のみ。共有メニュー登録は実質 Android Chrome のみ。
- iOS / Safari では上記 2 機能とも動作しない(インストールとオフライン動作は有効)。
- 初回インストール時に約 4MB を一括ダウンロードする。
- 共有経由で極端に長い図を渡すと URL 長の制限で切れる可能性がある。
- localStorage がブラウザのストレージ削除で消える点は従来どおり(永続化要求は行わない)。
