import { registerSW } from 'virtual:pwa-register'

export interface SetupPwaOptions {
  /**
   * 新しい版が待機状態になったときに呼ばれる。
   * 渡された関数を呼ぶと新しい Service Worker を有効化してページを再読み込みする。
   * 更新が続けて 2 回検知されるとこのコールバックも 2 回呼ばれるため、
   * 呼び出し側は同じ通知を重複させない実装にすること。
   */
  onUpdateAvailable: (apply: () => void) => void
}

/**
 * Service Worker を登録する。
 * 更新は自動適用しない。編集中に再読み込みされると CodeMirror の undo 履歴と
 * カーソル位置が失われるため、適用の判断はユーザーに委ねる。
 */
export function setupPwa({ onUpdateAvailable }: SetupPwaOptions): void {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      onUpdateAvailable(() => {
        // 待機中の Service Worker へ skipWaiting を送る。
        // 再読み込みは vite-plugin-pwa 側が controlling イベントを受けて行うため、
        // ここでの引数は現在の実装では参照されない
        void updateServiceWorker()
      })
    },
  })
}
