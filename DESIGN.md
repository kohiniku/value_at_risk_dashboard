## Design Spec
### Tone & Brand
- Minimal / Professional / Calm
- 情報密度は高いが、視覚的には余白を確保しグリッドをきれいに整列させる。

### Layout
Mainコンテナ（`max-w-6xl`, `space-y-8`）に以下の順番で縦積みする：
1. **FiltersBar** — 基準日Selectのみを配置。説明テキストで自動更新（60秒）を明示。
2. **VarContributionChart** — 単独資産積み上げ vs ポートフォリオVaR。カードフッターに分散効果を表示し、各セグメント内に日本語ラベル＋値を描画。
3. **AssetDetailsTable** — 重要指標のためチャート直下に配置。
4. **SummaryCards** — KPIのスナップショット。
5. **Timeseriesセクション** — 左カラムに `TimeseriesControls`（資産/観測日数セレクト）→ `VarChartCard`、右カラムに `NewsPanel`。
6. **ScenarioDistributionChart** — 直近800日のシナリオPLヒストグラムを最下部に配置し、セレクトはカード右肩。

### Tokens
- Font: Inter + Noto Sans JP, base 14px, `tabular-nums`を多用。
- Colors（Tailwind変数ベース）
  - Light: bg `#F4F6FB`, surface `#FFFFFF`, text `#101528`, primary `#2B63D9`, border `#D7DBEA`, muted `#4C5268`
  - Dark: bg `#05070F`, surface `#0F1327`, text `#F5F6FB`, primary `#6EA6FF`, border `#1A223B`, muted `#96A2C2`
- Radius: 14px, Shadow: soft, Spacing scale: 4/8/12/16/24/32/48。

### Components
- **FiltersBar**: `Card` + `Select(label="基準日")`。他セレクトは置かない。
- **VarContributionChart**: ApexCharts水平Stacked Bar。`dataLabels`を2行（資産名＋値）でカード内に必ず表示。グリッド/ツールチップはダークテーマ調。
- **AssetDetailsTable**:
  - 列：分類 / 資産 / VaR(m) / 前日比（値 + pct） / 変動要因4列 / VaR比較バー。
  - 分類はカテゴリ順（株式→金利→クレジット→不動産（モーゲージ）→コモディティ）でrowSpan表示。分類名の重複禁止。
  - 変動要因列ヘッダーは背景色+黒文字、セル背景は淡い色、数値は符号付きで他列と同じ色。列内で追加のバーは使わない。
  - 行末の横棒は資産VaRを最大値比で可視化し、同列に数値（m）を併記。
- **SummaryCards**: Card 3枚、値は`tabular-nums`、変化率は色（緑/赤）。
- **TimeseriesControls**: Select×2（資産、観測日数）。`Timeseries`カードの直前に置き、FiltersBarへ戻さない。
- **VarChartCard**: スムースライン、グラデーションフィル。
- **NewsPanel**: Skeletonでローディング。1行=見出し+ソース+時刻。
- **ScenarioDistributionChart**: ApexCharts column chart（24 bins）。x軸はPLレンジ（m）、y軸は件数。カード右肩のSelectで対象資産/`ALL_ASSETS`を切替。

### Responsiveness
- `<768px`: 全カードを1カラムにスタック。テーブルは横スクロール許容。Scenario chartは縦幅を`h-80`→`h-64`まで縮小可。
- `>=1024px`: Timeseries+Newsを2カラム、その他はフル幅。

### Accessibility
- 最低コントラスト比 4.5:1。変化率色だけに頼らず符号＋単位を明記。
- すべてのSelectにラベルあり。キーボード操作可。

### Behavioural Rules
- 自動更新（REFRESH_INTERVAL_MS、既定60秒）でSummary/Timeseries/Scenarioを順次再取得。手動リフレッシュボタンは設けない。
- すべての値/ラベルは日本語で表示。例: `ポートフォリオVaR`, `前日比`, `離脱` など。
- 前日比は1列で「+0.12 (＋1.3%)」形式。パーセントのみの列は作らない。
- 変動要因列の配色は固定：離脱=rose、追加=sky、ポジション=amber、順位=emerald。

### Chart Guidelines
- ApexCharts共通: `foreColor=#A0A7C1`, grid `#1E2743`, tooltipテーマ=dark。
- Stacked bar（VarContribution）: `plotOptions.bar.horizontal=true`, `barHeight=60%`, `legend bottom-left`。
- Scenario histogram: 24ビン固定、`columnWidth=80%`, `colors=['#FBBF24']`。x軸ラベルは45°回転で重なり防止。

### Don’ts
- 英語ラベルや略語を混在させない。
- 変動要因数値に追加のカラースケールを適用しない（背景のみ）。
- FiltersBarに資産/観測日数を戻さない。
- 手動リフレッシュUIは作らない。

# Design Foundation
- TailwindのCSS変数テーマ（`bg-background`, `text-foreground`, etc.）を利用。`darkMode: 'class'`。
- `components/ui` には Button / Select / Card / Skeleton / Switch 等の共通ピースがある。
- `AppHeader` にブランド、ホームリンク、ダークモードトグルを配置。トグルはローカルストレージに保存。
- `app/page.tsx` でロジックを組み立て、`useEffect`でデータをオートリフレッシュ。

## Future Extensions
- Scenarioヒストグラムに箱ひげ・信頼区間ラインを追加する余地あり。
- KPIカードへ「シナリオ離散度」「最大損失シナリオ」の指標を追加予定。
- StorybookでCard/Select/チャートの状態を可視化し、ビジュアルリグレッションに備える。
