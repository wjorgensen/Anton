import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#000000',
        'bg-secondary': '#0A0A0A',
        'bg-tertiary': '#141414',
        'bg-quaternary': '#1A1A1A',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A0',
        'text-muted': '#666666',
        'accent-primary': '#3B82F6',
        'accent-hover': '#60A5FA',
        'accent-active': '#2563EB',
        'accent-glow': 'rgba(59, 130, 246, 0.5)',
        'success': '#10B981',
        'success-glow': 'rgba(16, 185, 129, 0.3)',
        'warning': '#F59E0B',
        'warning-glow': 'rgba(245, 158, 11, 0.3)',
        'error': '#EF4444',
        'error-glow': 'rgba(239, 68, 68, 0.3)',
        'info': '#3B82F6',
        'border-primary': '#262626',
        'border-secondary': '#404040',
        'glass': 'rgba(255, 255, 255, 0.05)',
        'glass-border': 'rgba(255, 255, 255, 0.1)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'slide-out-right': 'slide-out-right 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'glow': 'glow 1.5s ease-in-out infinite alternate',
        'connection-pulse': 'connection-pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'shrink-width': 'shrink-width 1s linear forwards',
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        'shine': 'shine 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
          },
          '50%': {
            opacity: '.8',
            boxShadow: '0 0 40px rgba(59, 130, 246, 0.8)',
          },
        },
        'fade-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'slide-in-right': {
          '0%': {
            opacity: '0',
            transform: 'translateX(100%)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        'slide-out-right': {
          '0%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
          '100%': {
            opacity: '0',
            transform: 'translateX(100%)',
          },
        },
        'scale-in': {
          '0%': {
            opacity: '0',
            transform: 'scale(0.8)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        'glow': {
          '0%': {
            boxShadow: '0 0 5px rgba(59, 130, 246, 0.2), 0 0 10px rgba(59, 130, 246, 0.2), 0 0 15px rgba(59, 130, 246, 0.2)',
          },
          '100%': {
            boxShadow: '0 0 10px rgba(59, 130, 246, 0.4), 0 0 20px rgba(59, 130, 246, 0.4), 0 0 30px rgba(59, 130, 246, 0.4)',
          },
        },
        'connection-pulse': {
          '0%, 100%': {
            opacity: '0.6',
            strokeWidth: '2',
          },
          '50%': {
            opacity: '1',
            strokeWidth: '3',
          },
        },
        'float': {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-6px)',
          },
        },
        'shimmer': {
          '0%': {
            backgroundPosition: '-200% 0',
          },
          '100%': {
            backgroundPosition: '200% 0',
          },
        },
        'shrink-width': {
          '0%': {
            width: '100%',
          },
          '100%': {
            width: '0%',
          },
        },
        'pulse-slow': {
          '0%, 100%': {
            opacity: '0.6',
          },
          '50%': {
            opacity: '1',
          },
        },
        'shine': {
          '0%': {
            transform: 'translateX(-100%)',
          },
          '100%': {
            transform: 'translateX(100%)',
          },
        },
      },
      backdropBlur: {
        'xs': '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.37)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.3)',
        'glow-yellow': '0 0 20px rgba(245, 158, 11, 0.3)',
      },
    },
  },
  plugins: [],
}

export default config