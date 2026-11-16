/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral ramp tuned for a native, low-chroma surface palette. Existing
        // markup uses slate everywhere, so remapping it restyles the whole app.
        slate: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#ececee',
          300: '#e5e5e7',
          400: '#a1a1a6',
          500: '#86868b',
          600: '#6e6e73',
          700: '#48484a',
          800: '#2c2c2e',
          900: '#1c1c1e',
          950: '#101012'
        },
        // Single violet accent for focus, selection and primary emphasis.
        cyan: {
          50: '#f5f3ff',
          100: '#ece9ff',
          200: '#ded8ff',
          300: '#c6bcff',
          400: '#a094fb',
          500: '#7e70f4',
          600: '#6a5fe0',
          700: '#584cc6',
          800: '#453aa0',
          900: '#332b7a',
          950: '#1f1a4d'
        }
      },
      borderRadius: {
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px'
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI Variable"',
          '"Segoe UI"',
          'system-ui',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif'
        ],
        mono: [
          '"SF Mono"',
          '"Cascadia Code"',
          'Consolas',
          'ui-monospace',
          'monospace'
        ]
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
        elevated: '0 24px 64px rgba(0, 0, 0, 0.18)'
      }
    }
  },
  plugins: []
}
