import clsx from 'clsx'
import type { Asset, FactorVaR, Portfolio } from '@/types/var'
import { Card } from '@/components/ui/card'


const HUNDRED_MILLION: number = 100000000

interface AssetDetailsTableProps {
  assets: Asset[]
  factorVarList: FactorVaR[]
  portfolio: Portfolio
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


export function AssetDetailsTable({ assets, factorVarList, portfolio }: AssetDetailsTableProps) {
  type TransformedData = {
    [riskCategory: string]: {
      [currency: string]: {
        [riskFactor: string]: {
          risk_direction: string;
          amount: number;
        };
      };
    };
  };

  type FlattenedItem = {
    riskCategory: string;
    currency: string;
    riskFactor: string;
    riskDirection: string;
    amount: number;
    isFirstInCategory: boolean;
    isFirstInCurrency: boolean;
    categoryRowSpan: number;
    currencyRowSpan: number;
  };

  const transformData = (input: FactorVaR[]): TransformedData => {
    return input.reduce((result: TransformedData, item) => {
      const { risk_category, currency, risk_factor, risk_direction, var_amount } = item;

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
        amount: var_amount / HUNDRED_MILLION
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
        const currencyItems = Object.entries(riskFactors).map(
          ([riskFactor, details]) => ({
            riskCategory,
            currency,
            riskFactor,
            riskDirection: details.risk_direction,
            amount: details.amount,
            isFirstInCategory: false,
            isFirstInCurrency: false,
            categoryRowSpan: 0,
            currencyRowSpan: 0,
          })
        );

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
    ? Math.max(...factorVarList.map((item) => Math.abs(item.var_amount)))
    : 0;
  const maxAmount = Math.max(factorMax, portfolio.total, 1);

  const totalRow = {
    amount: portfolio.total,
    change_amount: portfolio.change_amount,
    change_pct: portfolio.change_pct,
  };

  return (
    <Card title="リスクファクター別VaR">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-border/60 text-sm">
          <thead className="bg-background/80 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-32 px-3 py-3 text-left">リスク分類</th>
              <th className="w-24 px-3 py-3 text-left">通貨</th>
              <th className="w-48 px-3 py-3 text-left">リスクファクター</th>
              <th className="w-24 px-3 py-3 text-right">VaR (億円)</th>
              <th className="w-[28rem] px-4 py-3 text-left">VaR比較バー</th>
              <th className="w-24 px-3 py-3 text-center">方向性</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {/* 合計行 */}
            <tr className="align-middle bg-muted/10 font-semibold">
              <td className="w-32 px-3 py-3 text-muted-foreground" colSpan={2}>
                全体
              </td>
              <td className="w-48 px-3 py-3">全リスク合算</td>
              <td className="w-24 px-3 py-3 text-right text-primary">
                {totalRow.amount.toFixed(2)}
              </td>
              <td className="w-[28rem] px-4 py-3">
                <VarLevelBar amount={Math.abs(totalRow.amount)} maxAmount={maxAmount} />
              </td>
              <td
                className={clsx(
                  'w-24 px-3 py-3 text-center font-medium',
                  totalRow.change_amount >= 0 ? 'text-emerald-400' : 'text-rose-400',
                )}
              >
                {totalRow.change_amount >= 0 ? '+' : ''}
                {totalRow.change_amount.toFixed(2)}
              </td>
            </tr>

            {/* リスクファクター別の行 */}
            {flatData.map((item) => (
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
                    maxAmount={maxAmount}
                  />
                </td>

                {/* リスク方向性の列 */}
                <td
                  className={clsx(
                    'w-24 px-3 py-3 text-center font-medium text-xs',
                    item.riskDirection === 'Positive' ? 'text-emerald-400' : 'text-rose-400',
                  )}
                >
                  {item.riskDirection}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function VarLevelBar({ amount, maxAmount }: { amount: number; maxAmount: number }) {
  if (maxAmount === 0) {
    return <div className="text-xs text-muted-foreground">データなし</div>
  }

  const normalized = Math.min(1, Math.max(0, amount / maxAmount))
  const ratio = normalized > 0 ? Math.pow(normalized, 0.5) : 0
  const clamped = Math.max(0.08, ratio)

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-border/60">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-sky-400"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
