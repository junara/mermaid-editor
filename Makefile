.PHONY: install setup dev preview build test fmt lint check icons deploy

install: ## 依存パッケージをインストール(pre-commit フックも有効化される)
	npm ci

setup: ## pre-commit フックを有効化(npm install 済みなら不要)
	git config core.hooksPath .githooks

dev: ## vite 開発サーバー起動
	npm run dev

preview: build ## ビルド成果物を配信(Service Worker は本番ビルドでのみ有効なため PWA の確認はこちら)
	npm run preview

build: ## 型チェック + 静的ビルド(dist/)
	npm run build

test: ## vitest 実行
	npm test

fmt: ## oxfmt でフォーマット
	npm run fmt

lint: ## oxlint 実行(型情報を使ったルールを含む)
	npm run lint

check: ## CI と同じ検証(フォーマット確認 + lint + 型チェック + テスト)
	npm run fmt:check
	npm run lint
	npx tsc --noEmit
	npm test

icons: ## SVG 原本から PWA 用の PNG を書き出す(要 rsvg-convert)
	@# public/favicon.svg は配信もされる資産、icons/ はビルド原本のみで配信しない
	rsvg-convert -w 192 -h 192 public/favicon.svg -o public/icon-192.png
	rsvg-convert -w 512 -h 512 public/favicon.svg -o public/icon-512.png
	@# iOS は透過を黒として合成するため、角丸の外側を背景色で埋めて全面塗りにする
	rsvg-convert -b '#1c7ed6' -w 180 -h 180 public/favicon.svg -o public/apple-touch-icon.png
	rsvg-convert -w 512 -h 512 icons/icon-maskable.svg -o public/icon-maskable-512.png

deploy: build ## ビルドして Cloudflare Workers へデプロイ
	npx wrangler deploy
