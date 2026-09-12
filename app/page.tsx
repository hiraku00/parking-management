// Phase 0: 骨組みのみのプレースホルダー。
// 実際のログイン画面（氏名＋電話番号下4桁 / QRログインへの導線）は
// Phase 3 で実装する。docs/design/07-screens.md §7.3 を参照。
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 text-slate-950">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Phase 0</p>
        <h1 className="mt-2 text-2xl font-semibold">駐車場管理システム</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          実装前の骨組みです。設計は{' '}
          <a
            href="https://github.com/hiraku00/parking-management/tree/main/docs/design"
            className="underline"
          >
            docs/design
          </a>{' '}
          を参照してください。
        </p>
      </div>
    </main>
  )
}
