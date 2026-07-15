import clsx from 'clsx'
import type { FactorVaR } from '@/types/var'
import { Card } from '@/components/ui/card'


import { HUNDRED_MILLION } from '@/lib/constants'

interface AssetDetailsTableProps {
  factorVarList: FactorVaR[]
  loading?: boolean
  volAdjMap?: Record<string, number>
  useVolatilityAdjustment?: boolean
}

export function AssetDetailsTable({ factorVarList, loading, volAdjMap, useVolatilityAdjustment }: AssetDetailsTableProps) {
  const showAdjCoeff = useVolatilityAdjustment === true && volAdjMap != null
  type TransformedData = {
    [riskCategory: string]: {
      [currency: string]: {
        [riskFactor: string]: {
          risk_direction: boolean | null;
          amount: number;
          comparison: number | null;
          has_data: boolean;
          adjCoeff: number | null;
        };
      };
    };
  };

  type FlattenedItem = {
    riskCategory: string;
    currency: string;
    riskFactor: string;
    riskDirection: boolean | null;
    amount: number;
    comparison: number | null;
    hasData: boolean;
    adjCoeff: number | null;
    isFirstInCategory: boolean;
    isFirstInCurrency: boolean;
    categoryRowSpan: number;
    currencyRowSpan: number;
  };

  // ソート用のIDマップを作成
  const categoryIdMap = new Map<string, number>();
  const currencyIdMap = new Map<string, number>();

  factorVarList.forEach(item => {
    categoryIdMap.set(item.risk_category, item.risk_category_id);
    const currencyKey = item.currency ?? "null";
    currencyIdMap.set(currencyKey, item.currency_id ?? 999999);
  });

  const displayFactorList = factorVarList.filter(
    (item) => item.risk_factor !== 'カテゴリ合算'
  )

  const transformData = (input: FactorVaR[]): TransformedData => {
    return input.reduce((result: TransformedData, item) => {
      const { risk_category, currency, risk_factor, risk_direction, var_amount, comparison, has_data } = item;

      // risk_categoryレベルの初期化
      if (!result[risk_category]) {
        result[risk_category] = {};
      }

      // currencyのキー（nullの場合は"null"という文字列として扱う）
      const currencyKey = currency ?? "null";

      // currencyレベルの初期化
      if (!result[risk_category][currencyKey]) {
        result[risk_category][currencyKey] = {};
      }

      // 調整係数の取得
      let adjCoeff: number | null = null
      if (showAdjCoeff && volAdjMap) {
        if (risk_category === '全体') {
          adjCoeff = volAdjMap['total'] ?? null
        } else {
          const key = `fac:${risk_category}:${currency ?? "null"}:${risk_factor}`
          adjCoeff = volAdjMap[key] ?? null
        }
      }

      // risk_factorレベルにデータを格納
      result[risk_category][currencyKey][risk_factor] = {
        risk_direction: risk_direction,
        amount: var_amount / HUNDRED_MILLION,
        comparison: comparison !== null ? comparison / HUNDRED_MILLION : null,
        has_data: has_data ?? true,
        adjCoeff,
      };

      return result;
    }, {});
  };

  // データをフラット化する関数
  const flattenTransformedData = (data: TransformedData): FlattenedItem[] => {
    const flattened: FlattenedItem[] = [];

    Object.entries(data)
      .sort(([a], [b]) => (categoryIdMap.get(a) ?? 999999) - (categoryIdMap.get(b) ?? 999999))
      .forEach(([riskCategory, currencies]) => {
        const categoryItems: FlattenedItem[] = [];

        Object.entries(currencies)
          .sort(([a], [b]) => (currencyIdMap.get(a) ?? 999999) - (currencyIdMap.get(b) ?? 999999))
          .forEach(([currency, riskFactors]) => {
            const currencyItems = Object.entries(riskFactors)
              .map(([riskFactor, details]) => ({
                riskCategory,
            currency,
            riskFactor,
            riskDirection: details.risk_direction,
            amount: details.amount,
            comparison: details.comparison,
            hasData: details.has_data,
            adjCoeff: details.adjCoeff,
            isFirstInCategory: false,
            isFirstInCurrency: false,
            categoryRowSpan: 0,
            currencyRowSpan: 0,
          }))
          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

        // 最初の行にフラグを立てる
        if (currencyItems.length > 0) {
          currencyItems[0].isFirstInCurrency = true;
          currencyItems[0].currencyRowSpan = currencyItems.length;
        }

        categoryItems.push(...currencyItems);
      });

      // 最初の行にフラグを立てる
      if (categoryItems.length > 0) {
        categoryItems[0].isFirstInCategory = true;
        categoryItems[0].categoryRowSpan = categoryItems.length;
      }

      flattened.push(...categoryItems);
    });

    return flattened;
  };

  const transformedData = transformData(displayFactorList);
  const flatData = flattenTransformedData(transformedData);

  // maxAmountの計算（displayFactorListの最大値）
  const factorMax = displayFactorList.length
    ? Math.max(...displayFactorList.map((item) => Math.abs(item.var_amount) / HUNDRED_MILLION))
    : 0;
  const maxAmount = Math.max(factorMax, 1);

  const getHue = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return Math.abs(hash) % 360
  }

  const getRiskDirectionLabel = (category: string, direction: boolean | null) => {
    if (category === '全体' || direction === null) {
      return '-'
    }
    if (category.includes('金利')) {
      return direction ? '低下' : '上昇'
    }
    if (category.includes('クレジット') || category.includes('為替')) {
      return direction ? '縮小' : '拡大'
    }
    if (category.includes('株') || category.includes('コモディティ') || category.includes('不動産')) {
      return direction ? '下落' : '上昇'
    }
    return '-'
  }

  const getRiskDirectionColor = (category: string, direction: boolean | null) => {
    // 上昇・拡大・増加 -> Green (emerald-400)
    // 下落・縮小・低下・減少 -> Red (rose-400)

    if (category === '全体' || direction === null) {
      return 'text-muted-foreground'
    }

    if (category.includes('金利')) {
      // True: 低下 (Red), False: 上昇 (Green)
      return direction ? 'text-rose-400' : 'text-emerald-400'
    }
    if (category.includes('クレジット') || category.includes('為替')) {
      // True: 縮小 (Red), False: 拡大 (Green)
      return direction ? 'text-rose-400' : 'text-emerald-400'
    }
    if (category.includes('株') || category.includes('コモディティ') || category.includes('不動産')) {
      // True: 下落 (Red), False: 上昇 (Green)
      return direction ? 'text-rose-400' : 'text-emerald-400'
    }
    return 'text-muted-foreground'
  }

  return (
    <Card title="リスクファクター別VaR" className="relative">
      {loading && (
        <div className="absolute inset-x-0 bottom-0 top-16 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-b-xl">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      <div className="overflow-x-auto relative z-10">
        <table className="min-w-full table-fixed divide-y divide-border/60 text-sm">
          <thead className="bg-background/80 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-32 px-3 py-3 text-left">リスク分類</th>
              <th className="w-24 px-3 py-3 text-left">通貨</th>
              <th className="w-48 px-3 py-3 text-left">リスクファクター</th>
              <th className="w-24 px-3 py-3 text-center">リスク拡大の<br/>方向性</th>
              <th className="w-24 px-3 py-3 text-right">VaR (億円)</th>
              <th className="w-[28rem] px-4 py-3 text-left">VaR比較バー</th>
              <th className="w-24 px-3 py-3 text-right">比較日からの<br/>増減 (億円)</th>
              {showAdjCoeff && (
                <th className="w-20 px-3 py-3 text-right">調整係数</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {flatData.length === 0 && (
              <tr className="align-middle hover:bg-muted/5">
                <td colSpan={showAdjCoeff ? 8 : 7} className="px-3 py-8 text-center text-muted-foreground">
                  データがありません
                </td>
              </tr>
            )}
            {/* リスクファクター別の行 */}
            {flatData.map((item) => {
              const hue = getHue(`${item.riskCategory}-${item.currency}`)
              return (
                <tr
                  key={`${item.riskCategory}-${item.currency}-${item.riskFactor}`}
                  className="align-middle hover:bg-muted/5"
                >
                  {/* リスク分類の列（カテゴリの最初の行のみ表示） */}
                  {item.isFirstInCategory && (
                    <td
                      className="w-32 px-3 py-3 font-bold text-foreground bg-muted/20"
                      rowSpan={item.categoryRowSpan}
                    >
                      {item.riskCategory}
                    </td>
                  )}

                  {/* 通貨の列（通貨グループの最初の行のみ表示） */}
                  {item.isFirstInCurrency && (
                    <td
                      className="w-24 px-3 py-3 font-semibold text-muted-foreground"
                      rowSpan={item.currencyRowSpan}
                    >
                      {item.currency === 'null' ? '-' : item.currency}
                    </td>
                  )}

                  {/* リスクファクターの列 */}
                  <td className="w-48 px-3 py-3 font-medium">
                    {item.riskFactor}
                  </td>

                  {/* リスク方向性の列 */}
                  <td
                    className={clsx(
                      'w-24 px-3 py-3 text-center font-medium text-xs',
                      getRiskDirectionColor(item.riskCategory, item.riskDirection)
                    )}
                  >
                    {getRiskDirectionLabel(item.riskCategory, item.riskDirection)}
                  </td>

                  {/* VaR金額の列 */}
                  <td className="w-24 px-3 py-3 text-right font-semibold text-primary">
                    {item.amount.toLocaleString('ja-JP', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>

                  {/* VarLevelBarの列 */}
                  <td className="w-[28rem] px-4 py-3">
                    <VarLevelBar
                      amount={Math.abs(item.amount)}
                      comparison={item.comparison !== null ? Math.abs(item.comparison) : undefined}
                      maxAmount={maxAmount}
                      hue={hue}
                    />
                  </td>

                  {/* 増減の列 */}
                   <td
                     className={clsx(
                       'w-24 px-3 py-3 text-right font-medium',
                       (() => {
                         if (item.comparison === null) return 'text-muted-foreground'
                        const diff = item.amount - item.comparison
                        // Negative delta only: render red with a Δ prefix.
                        if (diff < 0) return 'text-rose-400'
                        if (diff > 0) return 'text-emerald-400'
                        return 'text-muted-foreground'
                       })()
                     )}
                   >
                    {item.comparison !== null
                      ? (() => {
                          const diff = item.amount - item.comparison
                          if (diff < 0) {
                            const abs = Math.abs(diff).toLocaleString('ja-JP', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                            return `Δ${abs}`
                          }
                          return diff.toLocaleString('ja-JP', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                            signDisplay: 'exceptZero',
                          })
                        })()
                      : '-'}
                  </td>

                  {/* 調整係数の列 */}
                  {showAdjCoeff && (
                    <td className="w-20 px-3 py-3 text-right font-medium text-muted-foreground tabular-nums">
                      {item.adjCoeff !== null
                        ? item.adjCoeff.toLocaleString('ja-JP', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '-'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function VarLevelBar({ amount, comparison, maxAmount, hue }: { amount: number; comparison?: number; maxAmount: number; hue?: number }) {
  if (maxAmount === 0) {
    return <div className="text-xs text-muted-foreground">データなし</div>
  }

  const normalized = Math.min(1, Math.max(0, amount / maxAmount))
  const ratio = normalized
  
  const comparisonRatio = comparison !== undefined ? Math.min(1, Math.max(0, comparison / maxAmount)) : undefined

  return (
    <div className="flex flex-col w-full gap-1 justify-center">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className={clsx(
            'absolute inset-y-0 left-0 rounded-full',
            hue === undefined && 'bg-sky-400',
          )}
          style={{
            width: `${ratio * 100}%`,
            backgroundColor: hue !== undefined ? `hsl(${hue}, 70%, 50%)` : undefined,
          }}
        />
      </div>
      {comparisonRatio !== undefined && (
        <div className="relative h-1.5 w-full rounded-full bg-border/30">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-slate-400"
            style={{
              width: `${comparisonRatio * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}
