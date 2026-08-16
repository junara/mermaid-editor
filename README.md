# Mermaid エディタ

Mermaid 形式のテキストを編集し、リアルタイムでプレビューし、PNG / SVG として出力する個人用の Web ツール。
サーバーサイド処理を持たない静的サイトとして動作する。

## 機能

- CodeMirror 6 による Mermaid シンタックスハイライト(行番号、Tab インデント、undo / redo)
- 入力停止 300ms 後にプレビューを更新。構文エラー時は直前の図を保持し、ステータスバーにエラーを表示
- SVG 出力 / PNG 出力(スケール 1x・2x・3x、背景 透過・白)
- 入力停止 1 秒後に localStorage へ自動保存し、次回起動時に復元
- 左右ペインの分割比率をドラッグで変更し、比率を保存
- プレビューのズーム(50%〜200%、ボタンまたは Cmd + スクロール)

## セットアップ

Node.js 24.19.0(Active LTS)を前提とする。バージョンは `mise.toml` で固定している。

```bash
mise install
npm install
```

## ローカル起動

```bash
make dev
```

`http://localhost:5173` が開く。

## その他のコマンド

```bash
make build   # 型チェック + 静的ビルド(dist/)
make test    # ユニットテスト(Vitest)
make fmt     # oxfmt でフォーマット
make lint    # oxlint(型情報を使ったルールを含む)
make check   # フォーマット確認 + lint + 型チェック + テスト
make deploy  # ビルドして Cloudflare Workers へデプロイ
```

## 品質チェックの自動化

手で lint を回して直す運用にしないため、2 段階で強制する。

- **pre-commit フック** (`.githooks/pre-commit`) — ステージしたファイルを oxfmt で整形して
  コミットに含め、続けて lint・型チェック・テストを実行する。全体で 2 秒程度。
  `npm install` の `prepare` スクリプトで自動的に有効になる(手動なら `make setup`)。
  緊急時は `git commit --no-verify` で飛ばせる。
- **GitHub Actions** (`.github/workflows/ci.yml`) — push / pull request で `make check` を実行する。
  Node のバージョンは `mise.toml` から読み取るので、ローカルとずれない。

## デプロイ

Cloudflare Workers の Static Assets 機能で `dist/` を配信する(設定は `wrangler.jsonc`)。
公開 URL は `https://mmd.junara.dev`。ゾーン / DNS は別の非公開 infra リポジトリの Terraform で管理する。

## ライセンス

MIT
