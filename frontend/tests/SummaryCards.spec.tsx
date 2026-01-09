import { render, screen } from '@testing-library/react'
import { SummaryCards } from '@/components/dashboard/SummaryCards'

describe('SummaryCards', () => {
  it('renders provided metrics', () => {
    const metrics = [
      { label: 'ポートフォリオVaR', value: 21.8, delta: 0.7, change: 3.3 },
      { label: '最大寄与資産', value: 12.4, delta: 0.6, change: 5.1 },
    ]

    render(<SummaryCards metrics={metrics} />)

    expect(screen.getByText((content) => content.includes('ポートフォリオVaR'))).toBeInTheDocument()
    expect(screen.getByText('21.8')).toBeInTheDocument()
    const changeLabels = screen.getAllByText(
      (_, element) => element?.textContent?.replace(/\s/g, '').includes('+5.10%') ?? false,
    )
    expect(changeLabels.length).toBeGreaterThan(0)
  })
})
