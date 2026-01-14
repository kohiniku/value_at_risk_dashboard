import clsx from 'clsx'
import type { Asset, FactorVaR } from '@/types/var'
import { Card } from '@/components/ui/card'


const HUNDRED_MILLION: number = 100000000

interface AssetDetailsTableProps {
  assets: Asset[]
  factorVarList: FactorVaR[]
}

// const contributionColumns: {
//   key: keyof Asset['contributions']
//   label: string
//   headerClass: string
//   cellClass: string
// }[] = [
//   {
//     key: 'window_drop',
//     label: '離脱',
//     headerClass: 'bg-rose-500/10 text-black dark:text-white',
//     cellClass: 'bg-rose-500/5',
//   },
//   {
//     key: 'window_add',
//     label: '追加',
//     headerClass: 'bg-sky-500/10 text-black dark:text-white',
//     cellClass: 'bg-sky-500/5',
//   },
//   {
//     key: 'position_change',
//     label: 'ポジション',
//     headerClass: 'bg-amber-500/20 text-black dark:text-white',
//     cellClass: 'bg-amber-500/5',
//   },
//   {
//     key: 'ranking_shift',
//     label: '順位変動',
//     headerClass: 'bg-emerald-500/10 text-black dark:text-white',
//     cellClass: 'bg-emerald-500/5',
//   },
// ]


export function AssetDetailsTable({ assets, factorVarList }: AssetDetailsTableProps) {
  type TransformedData = {
    [riskCategory: string]: {
      [currency: string]: {
        [riskFactor: string]: {
          risk_direction: boolean;
          amount: number;
          comparison: number | null;
        };
      };
    };
  };

  type FlattenedItem = {
    riskCategory: string;
    currency: string;
    riskFactor: string;
    riskDirection: boolean;
    amount: number;
    comparison: number | null;
    isFirstInCategory: boolean;
    isFirstInCurrency: boolean;
    categoryRowSpan: number;
    currencyRowSpan: number;
  };

  const transformData = (input: FactorVaR[]): TransformedData => {
    return input.reduce((result: TransformedData, item) => {
      const { risk_category, currency, risk_factor, risk_direction, var_amount, comparison } = item;

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

      // risk_factorレベルにデータを格納
      result[risk_category][currencyKey][risk_factor] = {
        risk_direction: risk_direction,
        amount: var_amount / HUNDRED_MILLION,
        comparison: comparison !== null ? comparison / HUNDRED_MILLION : null
      };

      return result;
    }, {});
  };

  // データをフラット化する関数
  const flattenTransformedData = (data: TransformedData): FlattenedItem[] => {
    const flattened: FlattenedItem[] = [];

    Object.entries(data).forEach(([riskCategory, currencies]) => {
      const categoryItems: FlattenedItem[] = [];

      Object.entries(currencies).forEach(([currency, riskFactors]) => {
        const currencyItems = Object.entries(riskFactors)
          .map(([riskFactor, details]) => ({
            riskCategory,
            currency,
            riskFactor,
            riskDirection: details.risk_direction,
            amount: details.amount,
            comparison: details.comparison,
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

  const transformedData = transformData(factorVarList);
  const flatData = flattenTransformedData(transformedData);

  // maxAmountの計算（factorVarListも含める）
  const factorMax = factorVarList.length
    ? Math.max(...factorVarList.map((item) => Math.abs(item.var_amount) / HUNDRED_MILLION))
    : 0;
  const maxAmount = Math.max(factorMax, 1);

  const getHue = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return Math.abs(hash) % 360
  }

  const getRiskDirectionLabel = (category: string, direction: boolean) => {
    if (category === '全体') {
      return '-'
    }
    if (category.includes('金利')) {
      return direction ? '上昇' : '低下'
    }
    if (category.includes('クレジット') || category.includes('為替')) {
      return direction ? '拡大' : '縮小'
    }
    if (category.includes('株式') || category.includes('コモディティ') || category.includes('不動産')) {
      return direction ? '下落' : '上昇'
    }
    return direction ? '増加' : '減少'
  }

  const getRiskDirectionColor = (category: string, direction: boolean) => {
    // 上昇・拡大・増加 -> Green (emerald-400)
    // 下落・縮小・低下・減少 -> Red (rose-400)

    if (category === '全体') {
      return 'text-muted-foreground'
    }
    
    if (category.includes('金利')) {
      // True: 上昇 (Green), False: 低下 (Red)
      return direction ? 'text-emerald-400' : 'text-rose-400'
    }
    if (category.includes('クレジット') || category.includes('為替')) {
      // True: 拡大 (Green), False: 縮小 (Red)
      return direction ? 'text-emerald-400' : 'text-rose-400'
    }
    if (category.includes('株式') || category.includes('コモディティ') || category.includes('不動産')) {
      // True: 下落 (Red), False: 上昇 (Green)
      return direction ? 'text-rose-400' : 'text-emerald-400'
    }
    // Default: True: 増加 (Green), False: 減少 (Red)
    return direction ? 'text-emerald-400' : 'text-rose-400'
  }

  return (
    <Card title="リスクファクター別VaR">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-border/60 text-sm">
          <thead className="bg-background/80 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-32 px-3 py-3 text-left">リスク分類</th>
              <th className="w-24 px-3 py-3 text-left">通貨</th>
              <th className="w-48 px-3 py-3 text-left">リスクファクター</th>
              <th className="w-24 px-3 py-3 text-center">リスクの方向性</th>
              <th className="w-24 px-3 py-3 text-right">VaR (億円)</th>
              <th className="w-[28rem] px-4 py-3 text-left">VaR比較バー</th>
              <th className="w-24 px-3 py-3 text-right">比較日からの<br/>増減 (億円)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
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
                        if (diff > 0) return 'text-emerald-400'
                        if (diff < 0) return 'text-rose-400'
                        return 'text-muted-foreground'
                      })()
                    )}
                  >
                    {item.comparison !== null
                      ? (item.amount - item.comparison).toLocaleString('ja-JP', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                          signDisplay: 'exceptZero'
                        })
                      : '-'}
                  </td>
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

