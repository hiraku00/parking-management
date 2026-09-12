import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Phase 2 チェックリスト「全ての管理系アクションで requireOwner() を
 * 呼んでいるかのテスト」に対応する。
 *
 * 本来は各アクションを実際に呼び出し、オーナーが無い状態で拒否されることを
 * 確認したいが、Server Action は `next/headers` の `headers()`（フレームワークが
 * リクエストごとに用意する非同期コンテキスト）に依存しており、実際の
 * リクエストの外からテストで直接呼び出すことができない
 * （§08-implementation-plan.md Phase 5 の E2E で、実際のHTTPリクエストとして
 * 検証する）。
 *
 * そのため、ここでは静的な検査で代替する: `app/admin/**\/actions.ts` に
 * 定義された、フォーム送信等から直接呼ばれる公開アクション関数が、本文の
 * どこかで `requireOwner(` を呼んでいることをソースコードレベルで確認する。
 * 新しいアクションを追加した際にこのチェックを忘れると、このテストが失敗する。
 * 参照: docs/design/05-auth-security.md §5.1
 */

const ADMIN_ACTIONS_DIR = join(__dirname, '..', 'app', 'admin')

function findActionFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...findActionFiles(full))
    } else if (entry === 'actions.ts') {
      found.push(full)
    }
  }
  return found
}

/**
 * `export async function name(...): ReturnType { ... }` を、本文の閉じ括弧まで
 * 1つずつ切り出す。戻り値の型注釈（`Promise<{ error?: string }>` のように
 * 波括弧を含む場合がある）と本文を区別するため、パラメータリストを閉じる `)`
 * の後は山括弧 `<>` の深さを数え、深さ0で最初に現れる `{` だけを本文の開始と
 * みなす（`Promise<{...}>` の内側の `{` は山括弧の中なので無視される）。
 */
function extractExportedFunctions(source: string): { name: string; body: string }[] {
  const functions: { name: string; body: string }[] = []
  const header = /export\s+async\s+function\s+(\w+)\s*\(/g
  let headerMatch: RegExpExecArray | null
  while ((headerMatch = header.exec(source))) {
    let i = headerMatch.index + headerMatch[0].length
    // パラメータリストの対応する ")" を探す
    let parenDepth = 1
    for (; i < source.length && parenDepth > 0; i++) {
      if (source[i] === '(') parenDepth++
      if (source[i] === ')') parenDepth--
    }
    // 戻り値の型注釈を、山括弧の深さ0で最初の "{" まで読み飛ばす
    let angleDepth = 0
    for (; i < source.length; i++) {
      if (source[i] === '<') angleDepth++
      else if (source[i] === '>') angleDepth--
      else if (source[i] === '{' && angleDepth === 0) break
    }
    let braceDepth = 0
    const bodyStart = i
    for (; i < source.length; i++) {
      if (source[i] === '{') braceDepth++
      if (source[i] === '}') {
        braceDepth--
        if (braceDepth === 0) {
          i++
          break
        }
      }
    }
    functions.push({ name: headerMatch[1], body: source.slice(bodyStart, i) })
  }
  return functions
}

describe('管理系アクションはすべて requireOwner() を呼ぶ', () => {
  const actionFiles = findActionFiles(ADMIN_ACTIONS_DIR)

  it('app/admin/**/actions.ts が少なくとも1つは見つかる（検査対象が消えていないことの確認）', () => {
    expect(actionFiles.length).toBeGreaterThan(0)
  })

  for (const file of actionFiles) {
    const source = readFileSync(file, 'utf-8')
    const exportedFunctions = extractExportedFunctions(source)
    const relPath = file.slice(join(__dirname, '..').length + 1)

    it(`${relPath} に export された関数が見つかる`, () => {
      expect(exportedFunctions.length).toBeGreaterThan(0)
    })

    for (const fn of exportedFunctions) {
      it(`${relPath} の ${fn.name}() は requireOwner() を呼ぶ`, () => {
        expect(fn.body).toContain('requireOwner(')
      })
    }
  }
})
