import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './ui/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        ring: 'var(--ring)'
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', ...defaultTheme.fontFamily.sans]
      },
      borderRadius: {
        lg: '14px'
      },
      boxShadow: {
        card: '0 10px 30px -20px rgba(15, 19, 39, 0.65)'
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
}

export default config
