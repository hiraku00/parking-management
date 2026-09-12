/**
 * 氏名の照合キーを作る。全角/半角の表記ゆれ（"Ａ"→"A"、全角スペース→半角スペース等）を
 * NFKC正規化で吸収したうえで、空白をすべて除去する。
 * これを contractors.login_key として保存し、予備ログイン時の照合に使う。
 * 参照: docs/design/02-review-findings.md R22, docs/design/04-data-model.md
 */
export function normalizeName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, '')
}
