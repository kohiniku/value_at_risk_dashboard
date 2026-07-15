import { render, screen, within } from '@testing-library/react'
import { AssetDetailsTable } from '@/components/dashboard/AssetDetailsTable'

describe('AssetDetailsTable', () => {
  it('renders VaR even when risk direction is missing', () => {
    render(
      <AssetDetailsTable
        assets={[]}
        factorVarList={[
          {
            risk_category_id: 1,
            risk_category: '金利',
            currency_id: 392,
            currency: 'JPY',
            risk_factor: '10Y',
            risk_direction: null,
            var_amount: 200000000,
            comparison: null,
            has_data: true,
          },
        ]}
      />,
    )

    const row = screen.getByText('10Y').closest('tr')
    expect(row).not.toBeNull()
    if (!row) return

    const cells = within(row).getAllByRole('cell')
    expect(cells[3]).toHaveTextContent('-')
    expect(cells[3]).toHaveClass('text-muted-foreground')
    expect(cells[4]).toHaveTextContent('2.00')
  })
})

