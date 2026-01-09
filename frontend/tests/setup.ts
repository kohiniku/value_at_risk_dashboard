import '@testing-library/jest-dom'

// mock ResizeObserver used by ApexCharts in jsdom
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

declare global {
  interface Window {
    ResizeObserver: typeof MockResizeObserver
  }
}

// Assign the mock to the jsdom window object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ResizeObserver = MockResizeObserver
