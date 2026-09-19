# 10. デザインシステム（刷新）

作成日: 2026-09-18 / ステータス: **実装前の設計**

このドキュメントは、駐車場管理システムの見た目を `Practice/dashboard`（Apple／デジタル庁調の
ユニバーサルデザイン）と同じ言語に全面的に揃えるための、**トークンと部品の唯一の正**です。
画面ごとの当てはめは [11-ui-redesign.md](11-ui-redesign.md) を参照。

これまで前提だった **shadcn/ui ＋ indigo ＋ oklch トークン** は廃止し、dashboard と同じ
**手書きの意味的CSS（1枚の `app/globals.css` にトークンとクラスを定義、React は薄いプレゼン層）**
に置き換える（決定 D14。[README.md](README.md)）。07-screens.md §7.1 と §7.5 の
「shadcn / indigo を踏襲」という記述は本ドキュメントで上書きする。

---

## 10.1 方向宣言（デジ庁／Apple のユニバーサルデザイン）

- **ジョブ**: 契約者は「今いくら払えばよいか」を迷わず理解して支払う。オーナーは入金の
  全体像を素早く把握して消し込む。
- **レジスター（二層）**:
  - 契約者ポータル = **親愛・大きい・静か**。1画面に主な操作は1つ。未払いを責めない。
  - 管理画面 = **精密・密**。表が主体。情報密度を優先してよい。
  - 両者は同じトークンを共有し、**余白・文字サイズ・密度だけで語り分ける**（色や部品は変えない）。
- **サーフェス**: web。契約者はスマホ前提、オーナーはPC・スマホ両方。
- **パレット**: 地 `#eef0f5`、面 `rgba(255,255,255,.72)`、本文 `#1d1d1f`、
  アクセント `#0a84ff`、成功 `#16824a`、注意 `#8b5d00`、危険 `#c52a37`。
- **タイポ**: `-apple-system` / `SF Pro Display` / `Hiragino Sans`。数値は `tabular-nums`。
- **余白リズム**: 8ptグリッド。カード角丸 13〜18px、面はすりガラス＋淡い影。
- **モーション**: 150〜160ms ease-out。状態変化を説明するものだけ。`reduced-motion` で停止。
- **シグネチャー**: 地の放射グラデーション＋すりガラスのカード。金額は大きく `tabular-nums`。
  状態は必ず **アイコン＋文字＋色** の3点で示す。
- **禁じ手**:
  - 色だけで状態を示すこと（色覚や高齢の利用者に届かない）。
  - 契約者ポータルで密な表・小さい文字（14px未満）・二重の導線を使うこと。
  - 取り消せない操作を確認なしで実行すること。
  - `confirm()` / `alert()` / `target="_blank"` を使うこと。
  - ダークモードを今入れること（v1は対象外。トークンは将来対応できる形にしておく）。

---

## 10.2 デザイントークン（`:root`）

dashboard の値をそのまま採用し、駐車場ドメインの状態色を足す。`app/globals.css` の先頭に置く。

```css
:root {
  color-scheme: light;

  /* 面と地 */
  --bg: #eef0f5; /* ページの地 */
  --surface: rgba(255, 255, 255, 0.72); /* すりガラスのカード面 */
  --surface-solid: #fbfbfd; /* 不透明が要るとき（表ヘッダ等） */
  --raised: rgba(255, 255, 255, 0.88);

  /* 文字 */
  --ink: #1d1d1f; /* 本文・見出し */
  --muted: #6e6e73; /* 補足 */
  --faint: #8e8e93; /* ラベル・キャプション */

  /* 罫線 */
  --line: rgba(60, 60, 67, 0.18);
  --line-strong: rgba(60, 60, 67, 0.28);

  /* アクセント（青） */
  --blue: #0a84ff;
  --blue-strong: #006edb; /* hover・リンク文字 */
  --blue-soft: rgba(10, 132, 255, 0.12);

  /* 半状態色（意味色） */
  --good: #16824a; /* 支払い済み */
  --warning: #8b5d00; /* 確認中・要注意 */
  --danger: #c52a37; /* 滞納・却下・失敗 */

  /* 影・角丸・動き（部品はこれを参照する） */
  --radius-card: 16px;
  --radius-control: 11px;
  --radius-pill: 999px;
  --shadow-card: 0 14px 42px rgba(24, 39, 75, 0.07);
  --shadow-raise: 0 18px 42px rgba(24, 39, 75, 0.14);
  --ease: 160ms ease-out;
}
```

### 状態色マップ（駐車場ドメイン）

`StatusBadge`・入金マトリクス・KPIはこの対応で色とアイコンを引く。**色は必ず文字・アイコンと同時に出す。**

| 状態 (`portal-home` / invoice)   | 契約者向け文言         | アイコン | 前景色          | 背景            |
| -------------------------------- | ---------------------- | -------- | --------------- | --------------- |
| `all_paid` / paid                | お支払い済み           | ✅       | `--good`        | `--good` 10%    |
| `waiting_confirmation` / pending | 確認中                 | ⏳       | `--warning`     | `--warning` 12% |
| `needs_payment`（期日前）        | お支払いをお願いします | ●        | `--blue-strong` | `--blue-soft`   |
| `needs_payment`（期日超過）      | お支払いが遅れています | ⚠️       | `--danger`      | `--danger` 10%  |
| `rejected` / 失敗                | 確認できませんでした   | ❌       | `--danger`      | `--danger` 10%  |
| exempt（免除）                   | 免除                   | 免       | `--muted`       | grey 8%         |
| `card_in_progress`               | お手続き中             | ⏳       | `--blue-strong` | `--blue-soft`   |
| partial（一部入金）              | 一部お支払い済み       | ◐        | `--warning`     | `--warning` 12% |

---

## 10.3 レイアウトの骨格（2つのシェル）

dashboard の `.portal-shell`（読み物・広い行間）と `.app-shell`（密）に対応させる。

- **契約者ポータル** = `.portal-shell`（`width:min(560px, 100% - 32px)`, 縦一列）。
  スマホ最適の1カラム。上部に薄い固定ヘッダー（屋号のみ）、下は縦積みのカード。
- **管理画面** = `.app-shell`（`width:min(1320px, 100% - 48px)`）。上部に
  固定ヘッダー＋横スクロールナビ、下は表・KPIグリッド。

```css
body {
  min-height: 100vh;
  margin: 0;
  color: var(--ink);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Hiragino Sans', 'Yu Gothic UI', 'Noto Sans JP',
    sans-serif;
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 255, 255, 0.92), transparent 30rem),
    radial-gradient(circle at 96% 14%, rgba(194, 212, 247, 0.54), transparent 26rem), var(--bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.portal-shell {
  width: min(560px, calc(100% - 32px));
  margin: 0 auto;
  padding: 16px 0 64px;
}
.app-shell {
  width: min(1320px, calc(100% - 48px));
  margin: 0 auto;
  padding: 12px 0 40px;
}
```

---

## 10.4 タイポグラフィ

契約者は **本文18px** を最低とする（`test/portal-typography.test.ts` の不変条件を維持）。
管理は dashboard と同じ密なスケール（本文13〜15px）。

| 用途                    | サイズ / 行間        | 補足                                |
| ----------------------- | -------------------- | ----------------------------------- |
| 契約者 本文             | 18px / 1.7           | ポータル配下は 14px 未満を禁止      |
| 契約者 大見出し（状態） | 26〜30px / 1.2       | `letter-spacing:-.02em`             |
| 契約者 金額（主）       | 40〜48px / 1 tabular | `font-variant-numeric:tabular-nums` |
| 管理 h1 / h2 / h3       | 28 / 20 / 16px       | dashboard と同じ                    |
| 管理 本文・表セル       | 13〜15px / 1.4       | 数値列は tabular-nums               |
| ラベル・キャプション    | 11〜12px             | `--faint`、`letter-spacing:.04em`   |

---

## 10.5 部品カタログ

dashboard のクラスを駐車場向けに名前替え・追加したもの。**React 側は状態を渡すだけ**にし、
見た目はすべて CSS クラスで決める。以下は実装時の仕様（抜粋・擬似CSS）。

### 10.5.1 ボタン `.btn`

```
.btn            共通（min-height:44px, radius:var(--radius-control), font-weight:700, active:scale(.97)）
.btn--primary   青塗り（--blue → hover --blue-strong）。主操作
.btn--block     全幅・min-height:56px・font-size:18px。契約者の主ボタンは常にこれ
.btn--ghost     枠のみ／文字のみ。副操作（やめる・戻る）
.btn--danger    危険操作（却下）。--danger 系
.btn:disabled   opacity:.55, cursor:not-allowed（送信中は文言も変える）
```

- 契約者の主ボタンは **全幅56px（`.btn--block`）**。副操作は48px以上。
- 送信は `<form action={serverAction}>` ＋ `useActionState`。`useFormStatus` で送信中は無効化し
  「お支払いへ進む → 移動しています…」のように文言を替える。

### 10.5.2 状態ピル `.status-pill`（アイコン＋文字＋色）

```
.status-pill                 inline-flex, gap:6px, radius:var(--radius-pill), padding:6px 12px, font-weight:750
.status-pill--good/warn/...  §10.2 の状態色マップに一致
.status-pill .ico            絵文字またはSVG（aria-hidden、意味は文字で担保）
```

`components/portal/status-badge.tsx` を、色クラスを引く薄い実装に置き換える。**色だけに依存しない。**

### 10.5.3 契約者ホームの主状態カード `.state-hero`

今の状態を1つだけ大きく見せる中心部品。dashboard の `.portal-intro` を単一状態用に単純化。

```
.state-hero            すりガラス面, radius:20px, padding:28px 24px, shadow:var(--shadow-card)
.state-hero .pill      上部に status-pill
.state-hero .amount    金額を40〜48px tabular で
.state-hero .due       「◯月◯日までに」または「◯日遅れています」
.state-hero .actions   下に .btn--block（主）＋必要なら .btn--ghost（副）
.state-hero--overdue   左に4pxの --danger アクセントバー（色以外の手がかり）
```

### 10.5.4 選択カード `.choice-card`（大きなラジオ）

支払う月・支払い方法の選択に使う。ラベル全体がタップ領域（`<label>` で `<input type=radio>` を包む）。

```
.choice-card             display:flex, min-height:64px, radius:14px, border:1px solid --line-strong
.choice-card:has(:checked) border-color:--blue, background:--blue-soft, 左に選択マーク
.choice-card .title      18px/700   .choice-card .sub 補足（例: すぐに完了します）
```

選択肢が1つなら自動でステップを飛ばす（07 §7.3 の方針を維持）。

### 10.5.5 コピー可能な明細 `.copy-row`（振込先）

```
.copy-row       grid: ラベル / 値(tabular) / [コピー]ボタン。min-height:48px
.copy-row .btn  .btn--ghost の小型。押下で「コピーしました」を1.5秒表示（トースト or インライン）
```

### 10.5.6 履歴カード `.history-item`（表をやめてカードに）

契約者の履歴はスマホでカード。1件＝日付・◯月分・金額・状態ピル・［領収書 ›］。

### 10.5.7 管理: KPIカード `.kpi`

```
.kpi-grid   grid, 4列（→ 900px以下2列 → 560px以下1列）
.kpi        面, padding:18px 20px。 .kpi .label(11px faint) / .kpi strong(28px tabular) / .kpi .delta
.kpi--alert 未収・滞納は左に --danger／--warning のアクセントバー
```

### 10.5.8 管理: 表 → スマホでカード `.data-table`

dashboard の白眉。デスクトップは表、**760px以下では各行を1枚のラベル付きカードに変形**する
（横1000pxスクロールを強制しない）。入金一覧・請求一覧・契約者一覧に適用。

```css
/* desktop: 通常の table。mobile: */
@media (max-width: 760px) {
  .data-table,
  .data-table tbody {
    display: block;
  }
  .data-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .data-table tbody tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 15px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: var(--raised);
  }
  .data-table td::before {
    content: attr(data-label);
    display: block;
    color: var(--faint);
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.04em;
  }
}
```

### 10.5.9 管理: 入金マトリクス `.matrix`

行=契約者、列=直近12か月、セル=状態記号（✅ 済 / ◐ 一部 / ⏳ 確認中 / ⚠️ 滞納 / ○ 未払い /
— 対象外 / 免 免除）。セルは `<button>` で44px相当、クリックでその請求の詳細へ。
セルは記号＋色＋`aria-label`（例: 「田中太郎 6月 滞納」）。横スクロールし、左1列（氏名）を固定。

### 10.5.10 モーダル／確認ダイアログ `.modal`

- 契約者は**モーダルを使わない**（ステップ画面で代替）。
- 管理の取り消せない操作（承認・却下・免除・アーカイブ）は確認ダイアログを出す。
  shadcn を外すため、`<dialog>` 要素＋フォーカストラップの薄い自前部品 `components/ui/confirm-dialog.tsx`
  を用意する（Esc・背景クリックで閉じる、`aria-modal`、開いた要素へフォーカスを戻す）。
- 保存完了はトースト（`components/ui/toast.tsx`。dashboard の `.toast-notice` 相当）。

---

## 10.6 ユニバーサルデザインの不変条件（実装で守る・テストで固める）

| #   | 規則                                                                              | どう守るか                                         |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| U1  | 状態は必ず **アイコン＋文字＋色** の3点で示す（色のみ禁止）                       | `status-pill` に集約。既存 status-badge テスト維持 |
| U2  | タップ領域は最小44px、契約者の主ボタンは56px全幅                                  | `.btn` の min-height。lint/テストで確認            |
| U3  | 契約者本文は18px以上、`text-sm`/`text-xs` を使わない                              | `test/portal-typography.test.ts` を維持            |
| U4  | すべての操作可能要素に見える `:focus-visible`（3px `--blue` アウトライン）        | globals.css の共通ルール                           |
| U5  | コントラスト比 本文4.5:1・大きな文字3:1 以上                                      | トークンは充足。カスタム色を足す際に検証           |
| U6  | `prefers-reduced-motion` で transition/animation を停止                           | globals.css の共通メディアクエリ                   |
| U7  | 画像・アイコンに代替テキスト、フォームに `<label>`、`aria-live` でエラー/完了通知 | 各コンポーネントで担保                             |
| U8  | 専門用語を出さない（消込→お支払い、セッション→ログイン 等）                       | 文言ガイド（11 §11.6）                             |
| U9  | 確認は画面上に表示。`confirm()`/`alert()` 禁止                                    | 契約者=ステップ画面、管理=confirm-dialog           |
| U10 | 日本語フォントスタックを直接指定（next/font は使わない）                          | 03 §3.1 の判断を踏襲                               |

```css
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 3px solid rgba(10, 132, 255, 0.48);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
```

---

## 10.7 実装への落とし込み（ファイル構成）

```
app/globals.css                 トークン＋全クラス（1枚。dashboard と同じ方針）
components/ui/                   自前の薄い部品（button, status-pill, confirm-dialog, toast, field）
                                ※ shadcn の components/ui/* は撤去（§10.8 の移行表）
components/portal/status-badge.tsx  status-pill を引くだけに簡素化
lib/design/status.ts            状態→(文言, アイコン, 色クラス) の対応表（§10.2 を1か所に）
```

- **React は状態を渡すだけ**。分岐・文言・アイコン・色は `lib/design/status.ts` に集約し、
  契約者ホーム／マトリクス／履歴で共有する（表示の一貫性を1か所で保証）。
- 既存の Server Component ＋ D1 直読み（dashboard と同じ）は維持。見た目だけ差し替える。

## 10.8 shadcn からの移行表

| 現行 (shadcn)                  | 置き換え                                                  |
| ------------------------------ | --------------------------------------------------------- |
| `button.tsx`                   | `.btn` クラス＋薄い `Button`（variant を class に写像）   |
| `card.tsx` / `badge.tsx`       | `.state-hero` / `.kpi` / `.status-pill` クラス            |
| `table.tsx`                    | `.data-table`（§10.5.8 のカード変形つき）                 |
| `dialog.tsx` / `alert-dialog`  | `confirm-dialog.tsx`（`<dialog>`＋フォーカストラップ）    |
| `select.tsx` / `radio-group`   | ネイティブ `<select>` / `.choice-card`（`<input radio>`） |
| `input` / `textarea` / `label` | `.field` クラス群（ネイティブ要素）                       |
| `sonner`                       | `toast.tsx`（`.toast-notice`＋`aria-live`）               |
| `tabs.tsx`                     | `.tabs`（`<a>`/`<button>` の下線タブ）                    |
| `skeleton` / `separator`       | `.skeleton` / `<hr>`（軽量クラス）                        |

依存削除: `shadcn/tailwind.css`・`tw-animate-css`・radix 一式・lucide（絵文字＋必要最小のSVGに集約）。
`components.json` は撤去。Tailwind は残してもよいが、レイアウトはトークン＋クラス主導にする。
