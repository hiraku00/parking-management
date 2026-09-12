import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export type Db = ReturnType<typeof getDb>

/** D1Database から Drizzle クライアントを作る。Server ActionやRoute Handlerからは
 *  `getDb(appEnv().DB)` として、テストからは Miniflare が用意した `env.DB` を渡す。 */
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema })
}
