import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    // mermaid.js が支配的でバンドルサイズの上限は設けない方針のため、警告は抑制する
    chunkSizeWarningLimit: 4000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
