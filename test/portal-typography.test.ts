import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * docs/design/09-ux-improvements.md §9.4.8 の「本文18px・補足でも最小16px」
 * を静的に守るテスト。契約者ポータル配下では `text-sm`（14px）/`text-xs`（12px）
 * を使わない方針にする（`test/admin-actions-require-owner.test.ts` と同じ、
 * ソースを直接読む方式）。
 */

const TARGET_DIRS = [join(__dirname, '..', 'app', 'portal'), join(__dirname, '..', 'components', 'portal')]

function findTsxFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...findTsxFiles(full))
    } else if (entry.endsWith('.tsx')) {
      found.push(full)
    }
  }
  return found
}

describe('契約者ポータルは text-sm / text-xs を使わない', () => {
  const files = TARGET_DIRS.flatMap((dir) => findTsxFiles(dir))

  it('app/portal, components/portal に .tsx が少なくとも1つは見つかる（検査対象が消えていないことの確認）', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const relPath = file.slice(join(__dirname, '..').length + 1)
    it(`${relPath} は text-sm / text-xs を含まない`, () => {
      const source = readFileSync(file, 'utf-8')
      expect(source).not.toMatch(/\btext-sm\b/)
      expect(source).not.toMatch(/\btext-xs\b/)
    })
  }
})
