.PHONY: install setup dev build test fmt lint check deploy

install: ## 依存パッケージをインストール(pre-commit フックも有効化される)
	npm ci

setup: ## pre-commit フックを有効化(npm install 済みなら不要)
	git config core.hooksPath .githooks

dev: ## vite 開発サーバー起動
	npm run dev

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

deploy: build ## ビルドして Cloudflare Workers へデプロイ
	npx wrangler deploy
