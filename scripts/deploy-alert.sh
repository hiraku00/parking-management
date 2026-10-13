#!/usr/bin/env bash
# デプロイの失敗を GitHub Issue で知らせる。deploy.yml から呼ぶ。
#   failure: 未解決の「deploy-failure」Issueが無ければ起票し、あれば経過をコメントする。
#            リポジトリ所有者にアサインとメンションをして、GitHubの通知（メール・アプリ）を飛ばす。
#   success: 未解決の「deploy-failure」Issueに復旧をコメントして閉じる。
# 必要な環境変数: GH_TOKEN, GITHUB_REPOSITORY, GITHUB_REPOSITORY_OWNER, GITHUB_RUN_ID, GITHUB_SERVER_URL
# 任意: COMMIT_SHA, COMMIT_TITLE（失敗したコミットを本文に載せる）
set -euo pipefail

MODE="${1:-}"
if [ "$MODE" != "failure" ] && [ "$MODE" != "success" ]; then
  echo "使い方: $0 <failure|success>" >&2
  exit 2
fi
: "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_REPOSITORY_OWNER:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_SERVER_URL:?}"

LABEL="deploy-failure"
RUN_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
# コミットメッセージは複数行になり得るため、1行目（タイトル）だけを使う。
COMMIT_TITLE="$(printf '%s' "${COMMIT_TITLE:-}" | head -n 1)"
COMMIT_LINE="${COMMIT_SHA:+${COMMIT_SHA:0:7}}${COMMIT_TITLE:+ ${COMMIT_TITLE}}"

open_issues() {
  gh issue list -R "$GITHUB_REPOSITORY" --label "$LABEL" --state open --json number --jq '.[].number'
}

if [ "$MODE" = "failure" ]; then
  gh label create "$LABEL" -R "$GITHUB_REPOSITORY" --color B60205 \
    --description "本番デプロイの失敗（自動起票）" 2>/dev/null || true

  body="@${GITHUB_REPOSITORY_OWNER} 本番デプロイが失敗しました。

- コミット: ${COMMIT_LINE:-（不明）}
- 実行ログ: ${RUN_URL}

**まず「失敗したステップ」を確認してください。**
- Apply D1 migrations で失敗: マイグレーションは巻き戻されます。本番は直前の正常な状態のまま動き続けています。
- Deploy で失敗: マイグレーションだけ適用済みの可能性があります。直前のコードと互換か確認してください。
- Smoke test で失敗: デプロイ済みの本番が不調の可能性があります。至急確認してください。

次のデプロイが成功すると、このIssueは自動で閉じます。"

  existing="$(open_issues | head -n 1)"
  if [ -n "$existing" ]; then
    gh issue comment "$existing" -R "$GITHUB_REPOSITORY" --body "$body"
    echo "既存のIssue #${existing} にコメントしました。"
  else
    gh issue create -R "$GITHUB_REPOSITORY" --label "$LABEL" --assignee "$GITHUB_REPOSITORY_OWNER" \
      --title "本番デプロイが失敗しています" --body "$body"
  fi
else
  for n in $(open_issues); do
    gh issue comment "$n" -R "$GITHUB_REPOSITORY" \
      --body "復旧しました。デプロイが成功しています: ${RUN_URL}（${COMMIT_LINE:-不明}）"
    gh issue close "$n" -R "$GITHUB_REPOSITORY"
    echo "Issue #${n} を閉じました。"
  done
fi
