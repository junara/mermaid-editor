import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
  // ビルド時に埋め込む版情報。src/version.ts の declare const と対応させること。
  // version はデプロイのたびには上がらないため、PWA が掴んでいる版が最新かどうかは
  // ビルド日時で見分ける
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    // mermaid.js が支配的でバンドルサイズの上限は設けない方針のため、警告は抑制する
    chunkSizeWarningLimit: 4000,
  },
  plugins: [
    VitePWA({
      // 更新は自動適用せず、src/pwa.ts の通知経由でユーザーに適用させる
      registerType: 'prompt',
      // 登録コードの自動挿入は使わず、src/pwa.ts から明示的に登録する
      injectRegister: null,
      workbox: {
        // mermaid は図種ごとにチャンクを遅延ロードするため、コアだけをキャッシュすると
        // オフラインで未取得の図種を書いた瞬間に描画が失敗する。全成果物を precache する。
        // 拡張子を列挙する方式のため、漏れるとオフラインで静かに壊れる。
        // 新しい種類のアセットを追加したらここも足すこと
        globPatterns: [
          '**/*.{js,css,html,json,wasm}',
          '**/*.{svg,png,ico,jpg,jpeg,gif,webp,avif}',
          '**/*.{woff,woff2,ttf,otf}',
        ],
        // 既定の上限(2MiB)を超えるチャンクが現れても precache から漏れないようにする
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Mermaid エディタ',
        short_name: 'Mermaid',
        description: 'Mermaid テキストを編集し、プレビューして SVG / PNG として出力するエディタ',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        start_url: '/',
        scope: '/',
        // 明示しないとアプリの同一性が start_url に紐づき、将来 start_url を変えると
        // インストール済みのものが別アプリ扱いになる
        id: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // デスクトップ版 Chrome / Edge で .mmd をダブルクリックしたときの起動先にする
        file_handlers: [
          {
            action: '/',
            accept: { 'text/plain': ['.mmd', '.mermaid'] },
          },
        ],
        // 共有メニューからのテキストを ?text= で受け取る(POST は Service Worker の
        // 自前実装が必要になるため使わない)
        share_target: {
          action: '/',
          method: 'GET',
          params: { text: 'text' },
        },
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
