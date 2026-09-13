/**
 * 氏名の照合キーを作る。全角/半角の表記ゆれ（"Ａ"→"A"、全角スペース→半角スペース等）を
 * NFKC正規化で吸収したうえで、空白をすべて除去する。
 * これを contractors.login_key として保存し、予備ログイン時の照合に使う。
 * 参照: docs/design/02-review-findings.md R22, docs/design/04-data-model.md
 */
export function normalizeName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, '')
}

/**
 * フリガナの照合キーを作る。NFKC正規化のあと、ひらがなをカタカナに揃え、
 * 空白と「・」（姓名の区切りに使われることがある）を除去する。
 * これを contractors.login_kana_key として保存し、予備ログイン時に
 * login_key で見つからなかった場合の照合に使う。
 * 参照: docs/design/09-ux-improvements.md §9.4.10
 */
export function normalizeKana(kana: string): string {
  return kana
    .normalize('NFKC')
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s・]+/g, '')
}
