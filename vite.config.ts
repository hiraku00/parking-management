import { defineConfig } from 'vite'
import vinext from 'vinext'
import { cloudflare } from '@cloudflare/vite-plugin'
import { cdnAdapter } from '@vinext/cloudflare/cache/cdn-adapter'

// このアプリは契約者・オーナー個別のデータをすべての画面で表示するため、
// vinextのフルページキャッシュ（KVデータキャッシュ）は使わない。CDNキャッシュ
// アダプタのみ有効化し、静的アセットの配信だけをCloudflareのCache APIに任せる。
export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
