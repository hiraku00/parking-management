// デプロイのたびにスモークテストから叩く生存確認用エンドポイント。
// docs/design/08-implementation-plan.md §8.2 参照。
export function GET() {
  return Response.json({ status: 'ok' })
}
