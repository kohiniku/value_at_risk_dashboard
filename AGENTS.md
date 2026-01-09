This file provides guidance for AGENT AI when working with code in this repository.

## Project Overview
- 金融機関における保有資産のValue At Risk（99%ヒストリカル法）を可視化するダッシュボード。
- 株式 / 金利 / クレジット / モーゲージ / コモディティなど20資産超をカテゴリ別に管理し、VaR水準・分散効果・変動要因を即時比較。
- SQLite にデモデータ（直近5営業日のスナップショット、120日分の時系列、800日分のシナリオPL、ニュース）を保持。アプリ起動/テスト実行時に自動シードして常に最新状態を再現。
- UXは全面日本語表記・自動更新（リフレッシュボタン廃止）。凡例だけでなくグラフ内のラベルや表の色分けで変化点を直感的に把握できること。

## Required Functions & UX Rules
1. **基準日コントロール**
   - 画面最上部のFiltersBarで基準日（`/api/v1/var/dates`）を選択。変更するとサマリー、積み上げチャート、テーブル、KPIカード、ニュース、時系列すべてが即時更新される。
2. **VaR比較チャート**
   - `VarContributionChart`は「単独資産の積み上げ」と「ポートフォリオVaR」を1枚で比較し、カードフッターに分散効果（差分）を表示。
   - 各スタック内に日本語の資産名＋値（m単位）がデータラベルとして必ず描画されること。凡例だけに頼らない。
3. **資産別テーブル**
   - 列構成：分類（株式→金利→クレジット→不動産/モーゲージ→コモディティ）、資産名、VaR(m)、前日比（数値＋パーセンテージを括弧書きで1列）、4つの変動要因（離脱/追加/ポジション/順位）、VaR比較バー。
   - 変動要因列は背景色でカテゴリを示し、見出し文字は黒。数値は符号付き（+/-）で他列と同じスタイル。
   - 行末の横棒グラフは各資産VaRの大きさを比較する目的で使い、テーブル直下に配置しないこと。
4. **指標カード＋詳細エリア**
   - SummaryCardsはVaR総額・最大寄与資産・分散効果を表示。
   - TimeseriesControls（資産 / 観測日数セレクト）は時系列チャートと隣接させる。FiltersBarには置かない。
5. **ニュースパネル**
   - `/api/v1/news` の最新ヘッドラインを表示。ローディング中はSkeleton。
6. **シナリオPL分布**
   - `/api/v1/var/scenario-distribution?ric=` で取得する800日分のシナリオPLをヒストグラムにし、ダッシュボード最下部へ配置。
   - 選択肢は「全資産合算（RIC=`ALL_ASSETS`）」＋各資産。セレクトはカード右肩のアクションに配置し、更新は60秒間隔で自動再取得。

## Data & API Notes
- 起動時 (`app.main.on_startup`) に `app.db.seed.init_db()` を呼び、下記テーブルを再生成：
  - `var_snapshots`（5営業日分）、`asset_var_records`、`var_timeseries_records`（120日）、`news_records`、`scenario_distribution_records`（各資産+全資産×800サンプル）。
- 追加API: `/api/v1/var/scenario-distribution` が `ScenarioDistributionResponse { ric, values[] }` を返す。
- 全資産合算のRICは `ALL_ASSETS` でフロント/バック双方の定数 `AGGREGATE_RIC` / `PORTFOLIO_AGGREGATE_RIC` で共有すること。
- 変動要因4分類（window_drop, window_add, position_change, ranking_shift）はテーブル列と一致させ、寄与度の色も固定。

## Technology Stack
- **Frontend**: Next.js (App Router) + Tailwind CSS + ApexCharts + shadcn/ui コンポーネント。PayloadCMSテーマ構成を踏襲。
- **Backend**: FastAPI (Python 3.12) + SQLAlchemy ORM。
- **Package Management**: Pythonは `uv`、Nodeは `pnpm`（開発時はbind mountでホットリロード）。
- **Database**: SQLite（`DATABASE_URL`）。
- **Deployment**: docker compose + nginxリバースプロキシ。`.env`に主要定数を集約（`CORS_ORIGINS`はJSON配列）。

## Testing Expectations
- **Backend**: `uv run python -m unittest backend.tests.test_var_api` を最優先実行。API回帰（summary/timeseries/news/dates/scenario）が壊れていないか確認。
- **Frontend**: VitestでUIロジックをカバー（特にフォーマット関数・ステートフック）。E2Eは重要フロー（基準日変更、シナリオ切替）。
- **Integration**: API-frontend結合を想定したMock/Storybookを活用。自動更新ロジックはFakeTimersでテスト可能に。

## Execution Notes
- Pythonスクリプトは docker attach → `uv run <command>` の形で実行する。
- デモデータ再生成: `uv run python -m app.db.seed`。
- 自動更新を止めたい場合でもUI上にリフレッシュボタンを復活させない。Interval値は `.env` (`NEXT_PUBLIC_REFRESH_INTERVAL_MS`) で調整。
