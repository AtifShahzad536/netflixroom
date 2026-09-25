/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./sidepanel.html",
    "./popup.html"
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d0e12',
        surface: {
          DEFAULT: '#14161d',
          secondary: '#1b1e28',
          tertiary: '#222634',
          hover: '#2a2f40'
        },
        border: {
          DEFAULT: '#272b3a',
          light: '#353b4f'
        },
        accent: {
          DEFAULT: '#E50914',
          hover: '#b80710',
          subtle: 'rgba(229, 9, 20, 0.12)',
          glow: 'rgba(229, 9, 20, 0.35)'
        },
        netflix: {
          red: '#E50914',
          dark: '#141414',
          black: '#000000'
        }
      },
      borderRadius: {
        none: '0px',
        xs: '2px',
        sm: '3px',
        DEFAULT: '4px',
        md: '4px',
        lg: '5px',
        xl: '5px',
        '2xl': '5px',
        full: '5px' // Strict maximum 5px border-radius rule
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
