# Value at Risk Backend Architecture

当プロジェクトのバックエンド（FastAPI + ClickHouse）は、保守性・可読性・テスト容易性を高めるため、クリーンアーキテクチャの原則に基づき以下のように責務分離を行っています。

## ディレクトリ構成と役割

```text
backend/app/
├── api/
│   ├── endpoints/       # Controller層。FastAPIのルーティング、リクエスト受け付けとレスポンスの返却。
│   ├── dependencies/    # FastAPIの Depends() で利用する依存関係解決モジュール。
│   │                    # リクエストパラメータをドメインモデルやStrategyに変換し、不正な値はここで 400エラー にします。
│   └── deps.py          # データベース接続（Session）などのインフラストラクチャの注入設定。
├── core/
│   ├── config.py        # 環境変数などの設定管理。
│   └── constants.py     # アプリケーション全体で利用される定数（無視するアセットの条件など）。
├── db_ch/
│   ├── models.py        # SQLAlchemyのORMモデル定義（ClickHouseのテーブルスキーマと対応）。
│   └── session.py       # データベース接続ファクトリ。
├── models/
│   ├── domain/          # ドメイン駆動設計（DDD）におけるビジネスルールを表現するピュアなPythonクラス群。
│   │   ├── factor_var_result.py # VaR集計結果を表し、リスク方向の判定など自身のデータに対する計算ロジックを持つDTO。
│   │   ├── filters.py           # APIからの検索条件を表現する値オブジェクト群（不変・完全コンストラクタ）。
│   │   ├── specifications.py    # 特定の条件を満たすか（SQLAlchemyのwhere句に変換できるか）を判定する仕様パターン。
│   │   └── strategies.py        # データ取得における戦略（日報データを優先するか否か等）を表現するStrategyパターン。
│   └── var.py           # クライアントへ返すJSONレスポンスのスキーマ（Pydanticモデル）。
├── queries/             # Query Object パターン。複雑なCTEやSQL構築ロジックをカプセル化した純粋関数群。
│   ├── exposure_query.py        # Delta/Vega などのエクスポージャー集計クエリ構築。
│   └── scenario_pl_query.py     # シナリオPLの抽出や集計クエリ構築。
├── repositories/        # データアクセス層。ドメイン層とDBインフラの橋渡しを行い、QueryObjectを使ってSQLを実行します。
│   ├── base_repository.py       # fetch_all 等の定型的なDB処理を提供する基底クラス。
│   ├── exposure_repository.py   # FactorVaRなどの非常に重いエクスポージャー・シナリオ計算を実行。
│   ├── scenario_pl_repository.py# 時系列やヒストグラムなどPLデータの抽出。
│   ├── simulation_repository.py # シミュレーション用のベースデータ抽出。
│   ├── snapshot_date_repository.py # データの基準日に関する抽出。
│   └── volatility_repository.py # ボラティリティ算出用の生データ抽出。
└── services/            # アプリケーションサービス層（ユースケース）。
    ├── var_service.py           # リポジトリからデータを取得し、ドメインモデルを組み合わせてビジネスロジックを適用。
    ├── simulation_service.py    # CSVのパースやシミュレーション関連のユースケース。
    ├── date_service.py          # 営業日計算などのドメインサービス。
    └── volatility.py            # 標準偏差等のピュアな計算ロジック。
```

## 設計のハイライト

1. **生焼けオブジェクトの排除**
   APIの入力をControllerで直ちに `BranchFilters` などの「値オブジェクト」に変換しています。これにより、ServiceやRepository層ではデータの妥当性を疑うことなく処理に集中できます。
2. **Strategy / Specification パターンの導入**
   「日報優先のフラグ」や「部門・部署による絞り込み」など、コードの中で `if` 文が掛け算に増える原因だったものを、多態性（ポリモーフィズム）を用いたオブジェクトに分割しました。これにより条件分岐の迷宮を解消しています。
3. **Query Object パターンによる SQL (トランザクションスクリプト) の分離**
   1,000行を超えていた `var_service.py` から、SQLAlchemyの複雑なクエリ構築ロジックを `queries/` や `repositories/` 配下に完全移管しました。ServiceはピュアなPythonの世界でビジネスロジック（前日比の計算や全体VaRとの比較など）にのみ集中しています。
4. **Depends の活用による関心事の分離**
   DBセッションの開閉や、パラメータからのオブジェクト生成を `Depends` に任せることで、テスト時のモック化が極めて容易になっています。
