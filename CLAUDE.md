# CLAUDE.md — Value at Risk Dashboard

## 1. プロジェクト概要

金融機関が保有する 20 以上の資産について、**99% ヒストリカル法** による VaR（Value at Risk）を可視化するダッシュボード。
株式・金利・クレジット・不動産（モーゲージ）・コモディティ・為替にまたがるリスク量を即座に比較し、分散効果や変動要因を把握できる。

- UI テキストはすべて **日本語**
- **自動更新のみ**（手動リフレッシュボタンは設けない）
- 変化点はチャート内ラベルとテーブル色分けで直感的に識別させる

---

## 2. 技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + ApexCharts + shadcn/ui |
| Backend | FastAPI (Python 3.12) + SQLAlchemy ORM |
| Database | ClickHouse（`CHDB_*` 環境変数 / `app/db_ch/*`） |
| パッケージ管理 | Python: `uv` / Node: `pnpm` |
| デプロイ | Docker Compose（backend + frontend + nginx の 3 コンテナ） |
| リバースプロキシ | Nginx（`infra/nginx/default.conf`）。`/api/` → backend、`/` → frontend |
| リンター | Backend: Ruff / Frontend: ESLint (next/core-web-vitals) |
| テスト | Backend: `unittest` / Frontend: Vitest + Testing Library |
| アイコン | Lucide React（他のアイコンライブラリを混在させない） |

---

## 3. ディレクトリ構成

```text
value_at_risk_dashboard/
├── backend/
│   ├── app/
│   │   ├── api/               # Controller 層（endpoints / dependencies）
│   │   ├── core/              # config.py（pydantic-settings）, constants.py
│   │   ├── db_ch/             # ClickHouse ORM モデル, セッション管理
│   │   ├── models/
│   │   │   ├── domain/        # DDD: filters, strategies, specifications, factor_var_result
│   │   │   └── var.py         # Pydantic レスポンスモデル
│   │   ├── queries/           # Query Object パターン（exposure / scenario_pl）
│   │   ├── repositories/      # データアクセス層
│   │   ├── services/          # アプリケーションサービス（var / simulation / date / volatility）
│   │   └── main.py            # FastAPI エントリーポイント
│   └── tests/
├── frontend/
│   ├── app/                   # Next.js App Router（page.tsx, layout.tsx, globals.css）
│   ├── components/
│   │   ├── dashboard/         # FiltersBar, SummaryCards, AssetDetailsTable, VarChartCard, SimulationInputTable
│   │   └── ui/                # shadcn/ui 共通コンポーネント（button, card, select, skeleton, switch）
│   ├── hooks/                 # useTheme.ts
│   ├── lib/                   # branchFilters.ts, constants.ts, metrics.ts
│   ├── types/                 # var.ts（型定義）
│   └── tests/
├── infra/nginx/               # Nginx 設定
├── docker-compose.yml
├── .env / .env.example
└── VAR_CALCULATION_LOGIC.md   # VaR 計算ロジック仕様書
```

---

## 4. 開発コマンド

```bash
# Docker Compose で一括起動
docker compose up --build

# Backend 単体
cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend 単体
cd frontend && pnpm dev

# テスト
cd backend && uv run python -m unittest discover tests   # test_var_api.py, test_query_integrity.py が必須
cd frontend && pnpm test                                  # Vitest
cd frontend && pnpm lint                                  # ESLint

# リンター（Backend）
uv run ruff check backend/app
uv run ruff format backend/app
```

---

## 5. 環境変数

ポート番号を含むすべての設定はプロジェクトルートの `.env` で一元管理する（`.env.example` がテンプレート）。

| 変数 | 説明 |
|---|---|
| `NGINX_PORT` | Nginx の公開ポート |
| `CHDB_URL` / `CHDB_PORT` / `CHDB_USER` / `CHDB_PASSWORD` / `CHDB_DATABASE` | ClickHouse 接続情報 |
| `CORS_ORIGINS` | JSON 配列またはカンマ区切り文字列 |
| `VAR_DATA_SOURCE` | `auto`（ClickHouse＋デモフォールバック）/ `demo`（常にデモデータ） |
| `NEXT_PUBLIC_API_BASE_URL` | フロントエンド API ベースパス（デフォルト `/api/v1`） |
| `NEXT_PUBLIC_REFRESH_INTERVAL_MS` | 自動更新間隔（ms）。0 以下で自動更新停止 |

---

## 6. アーキテクチャ原則

### Backend

- **クリーンアーキテクチャ**: Controller → Service → Repository → Query Object → ClickHouse
- **pydantic-settings** で設定管理。環境変数と `.env` の両方から読み込み
- DB セッションは FastAPI `Depends` で注入（`get_db` パターン）
- API の入力は Controller で即座に値オブジェクト（`BranchFilters` 等）に変換し、Service/Repository 層では妥当性を疑わない
- Strategy / Specification パターンで条件分岐を多態性に分離
- Query Object パターンで複雑な SQL 構築ロジックをカプセル化

### Frontend

- API 通信はフロントエンドから相対パス（`/api/v1/...`）で行い、Nginx でバックエンドへ振り分け
- ダークモード: CSS カスタムプロパティでテーマ定義、`localStorage` に保存、OS 設定にフォールバック
- `AppHeader` にブランドロゴ、ホームリンク、ダークモードトグルを配置

---

## 7. UI / UX 仕様

### レイアウト（縦積み順）

1. **FiltersBar** — 基準日 Select のみ。自動更新（60 秒）を説明テキストで明示
2. **VarContributionChart** — 単独資産積み上げ vs ポートフォリオ VaR。カードフッターに分散効果。各セグメント内に日本語ラベル＋値
3. **AssetDetailsTable** — チャート直下
4. **SummaryCards** — KPI スナップショット（全体 VaR / 最大寄与資産 / 分散効果）
5. **Timeseries セクション** — `TimeseriesControls`（資産/観測日数セレクト）→ `VarChartCard`
6. **ScenarioDistributionChart** — ⚠️ **現在停止中**（後述）

### AssetDetailsTable

- **カテゴリ順**: 金利 → 株・REIT → クレジット → コモディティ → 為替 → 調整
- **変動要因 4 列**: 離脱（rose）/ 追加（sky）/ ポジション（amber）/ 順位（emerald）
  - ヘッダー背景色＋黒文字、セル背景は淡色、数値は符号付き
- 行末の横棒グラフは VaR 比較用（テーブル下ではなく行内に配置）
- 前日比は 1 列で「+0.12 (＋1.3%)」形式

### デザイントークン

- Font: Inter + Noto Sans JP, base 14px, `tabular-nums`
- Light: bg `#F4F6FB`, surface `#FFFFFF`, text `#101528`, primary `#2B63D9`
- Dark: bg `#05070F`, surface `#0F1327`, text `#F5F6FB`, primary `#6EA6FF`
- Radius: 14px, Shadow: soft, Spacing: Tailwind 4px グリッド
- `darkMode: 'class'`（`<html>` に `.dark` クラスを付与）

### チャート共通設定

- ApexCharts: `foreColor=#A0A7C1`, grid `#1E2743`, tooltip テーマ = dark
- Stacked bar: `horizontal=true`, `barHeight=60%`, `legend bottom-left`
- Scenario histogram: 24 ビン固定、`columnWidth=80%`、`colors=['#FBBF24']`

### Don'ts

- 英語ラベルや略語を混在させない
- 変動要因数値に追加のカラースケールを適用しない（背景のみ）
- FiltersBar に資産/観測日数セレクトを配置しない
- 手動リフレッシュ UI を作らない
- CSS 変数を経由せず色をハードコードしない
- 既存と別のアイコンライブラリを追加しない

---

## 8. ⚠️ シナリオ P/L ヒストグラム（停止中）

- 元仕様: 800 日分のシナリオ P/L をヒストグラム表示
- 現状: **UI に表示しない**。バックグラウンドポーリングで深刻なパフォーマンス劣化（Ghost Polling インシデント）が発生したため停止中
- **明示的な指示がない限り、ポーリングや UI 描画を再有効化しないこと**

---

## 9. 絶対に守るべきルール（インシデント履歴に基づく）

### 9.1 インフラ・運用安全

- **破壊的コマンドの前にターゲットを確認する**。過去にコンテナ名の取り違えで無関係なサービスを再起動した事例あり
- **Docker + pnpm**: `node-linker=hoisted` を `.npmrc` に設定済み。`pnpm install --force` のような一時凌ぎは禁止
- **一時ファイルの即時削除**: `patch.py` 等のリファクタ用スクリプトは作業後すぐに削除。安全でないシェルワイルドカード (`rm *`) は使わない

### 9.2 ClickHouse クエリの安全性

- `SHOW CREATE TABLE` でインデックス（`ORDER BY`）と型を確認してから集計クエリを書く
- **盲目的な型キャスト禁止**: `CAST(x, Float)` でエラーを黙らせるとインデックスが無効化されフルテーブルスキャンが発生する
- **CTE クロスジョイン罠**: パーティションキー（`asof_date` 等）を CTE に抽象化して JOIN すると ClickHouse のパーティションプルーニングが効かなくなる。**必ず `WHERE` 句に直接バインドする**

### 9.3 API 契約とデータ境界

- **Pydantic モデルとの整合性**: リファクタ時に返却キーや型がレスポンスモデルと不一致になると 503 Validation Error が発生する（過去例: `as_of_date` vs `date`、`data_points` vs `values`）
- **単位変換の維持**: ClickHouse 生値と UI 表示値（億円等）の変換（`÷ 100_000_000` 等）をリファクタ時に落とさない
- **ペイロード変更時のクロスチェック**: フォーマットを変更する場合（例: `TOTAL` → `total`）、必ず `grep` でフロントエンドの消費箇所を確認する

### 9.4 ビジネスロジックの保全

- **フォールバックロジックの脱落防止**: God Class 分割時に `as_of = latest_date` フォールバックや `UNION ALL` ブランチを落とさない
- **計算パイプラインの一貫性**: シミュレーション ON 時はデルタ入力がゼロでも ON のパイプラインを通す。OFF ロジックにフォールバックしない
- **数学的ロジックの改変禁止**: 800 日標準偏差ルール等のビジネスロジックを「コード整理」目的で変更しない

### 9.5 エラーハンドリング

- **例外の握り潰し禁止**: `except Exception:` で空のフォールバック（`[]`, `{}`）を返さない。トレースバックをログに残し、`HTTPException` (500/503) で明示的にエラーを返す

---

## 10. VaR 計算ロジック（概要）

詳細は [`VAR_CALCULATION_LOGIC.md`](./VAR_CALCULATION_LOGIC.md) を参照。

- **手法**: ヒストリカル・シミュレーション法（信頼水準 99%、観測期間 800 営業日、保有期間 1 日）
- **4 パターン**: シミュレーション ON/OFF × 日報デルタ優先 ON/OFF の 2×2 マトリクス
- **基礎 VaR**: 800 日分の日次シナリオ PL を昇順ソートし、ワースト 8 位（`rn == 8`）を抽出
- **フロントエンド調整**:
  - マンスリー換算: `VaR × √22`
  - ボラティリティ調整: `(std132 / std800) × 1.17`（フロア = 1.0）

---

## 11. リファクタリング方針

- **既存の振る舞いを保全する**リファクタリングが最優先
- 生焼けオブジェクトの排除（完全コンストラクタ＋ガード節）
- 不変性の維持（再代入回避、新インスタンス生成パターン）
- 高凝集・低結合（計算ロジックはデータに近い場所へ）
- God Class / トランザクションスクリプトの分割: DB クエリ（Repository/Query Object）、ビジネスルール（Domain Service）、API ルーティングを明確に分離
- 条件分岐の簡素化: 早期リターン、Strategy / Specification パターンの活用
- 命名は目的ベース（`Common`, `Util`, `Manager` のような曖昧な名前を避ける）
- Tell, Don't Ask（コマンド・クエリ分離、フラグ引数の排除）
