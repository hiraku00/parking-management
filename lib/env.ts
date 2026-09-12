import { env } from 'cloudflare:workers'

/**
 * `cloudflare:workers` の env に触れるのはこのファイルだけにする。
 * OpenNextなど別のCloudflareアダプタへ移るときに、差し替え箇所をここに
 * 限定するため。型は `npm run typecheck`（`wrangler types`）が
 * wrangler.jsonc から生成する `Env`（worker-configuration.d.ts）を使う。
 * 参照: docs/design/03-architecture.md §3.4
 */
export function appEnv(): Env {
  return env
}
