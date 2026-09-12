import { defineConfig } from 'drizzle-kit'

// このプロジェクトは drizzle-kit を migrations/*.sql の生成にしか使わない
// （適用は `wrangler d1 migrations apply` が行う）。そのため dbCredentials は不要。
export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.ts',
  out: './migrations',
})
