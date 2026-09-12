import { defineConfig } from 'vite'
import vinext from 'vinext'
import { cloudflare } from '@cloudflare/vite-plugin'

// エッジキャッシュ（CDN・KVデータキャッシュ）は使わない。ほぼ全画面が個人データを
// 含むため、キャッシュ対象と誤判定されたページが他人に表示される危険を避ける。
// 静的アセットは Workers Static Assets がそのまま配信する。
// 参照: docs/design/03-architecture.md §3.3
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
