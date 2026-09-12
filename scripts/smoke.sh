#!/usr/bin/env bash
# デプロイ後の生存確認。デプロイのたびにCIから呼ぶ。
# 参照: docs/design/08-implementation-plan.md §8.2
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "使い方: $0 <base-url>" >&2
  echo "例: $0 https://parking-management.hiraku00.workers.dev" >&2
  exit 1
fi

BASE_URL="${1%/}"
FAILED=0

check() {
  local path="$1"
  local expected="$2"
  local method="${3:-GET}"
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "${BASE_URL}${path}")
  if [ "$status" = "$expected" ]; then
    echo "OK   ${method} ${path} -> ${status}"
  else
    echo "FAIL ${method} ${path} -> ${status}（期待値: ${expected}）"
    FAILED=1
  fi
}

check /api/health 200
check / 200
# Access未認証では、エッジのAccess設定が有効ならAccessのログイン画面へ
# 302リダイレクトされる（本来の状態）。Access自体が未設定/エッジ設定漏れの
# 場合は、proxy.tsのフォールバックにより403になる。
check /admin 302
# Webhookエンドポイントはstripe-signatureが無いリクエストを拒否する。
# GETメソッド自体は未実装のため405。
check /api/webhooks/stripe 405 GET

if [ "$FAILED" -ne 0 ]; then
  echo "スモークテストに失敗した項目があります。" >&2
  exit 1
fi
echo "スモークテストはすべて成功しました。"
