export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          bg: '#F5F9FF',
          blue: '#155EEF',
          'blue-hover': '#1248C7',
          teal: '#0F766E',
          'teal-light': '#F0FDFA',
          'teal-border': '#CCFBF1',
          gold: '#F59E0B',
          'gold-light': '#FFFBEB',
          text: '#172033',
          muted: '#64748B',
          card: '#FFFFFF',
          border: '#E2E8F0',
          success: '#16A34A',
          'success-light': '#F0FDF4',
          error: '#DC2626',
          'error-light': '#FEF2F2',
          info: '#155EEF',
          'info-light': '#EFF6FF',
        },
        govblue: {
          50: '#F5F9FF',
          100: '#EFF6FF',
          200: '#DBEAFE',
          500: '#155EEF',
          600: '#155EEF',
          700: '#1248C7',
          800: '#0F3DA3',
          900: '#0A2558'
        },
        govteal: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          500: '#14B8A6',
          600: '#0F766E',
          700: '#115E59',
          800: '#134E4A'
        },
        govgold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309'
        }
      },
      borderRadius: {
        'gov-btn': '10px',
        'gov-card': '16px',
      },
      boxShadow: {
        'gov-subtle': '0 1px 3px 0 rgba(23, 32, 51, 0.05), 0 1px 2px -1px rgba(23, 32, 51, 0.03)',
        'gov-card': '0 4px 20px -2px rgba(21, 94, 239, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        'gov-hover': '0 12px 30px -4px rgba(21, 94, 239, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
      }
    },
  },
  plugins: [],
}
