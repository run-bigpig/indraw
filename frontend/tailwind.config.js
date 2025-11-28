/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        tech: {
          900: '#0B0E14',
          800: '#151923',
          700: '#1E2433',
          600: '#2A3245',
          500: '#4B5563',
          accent: '#06B6D4', // Cyan-500
          accentHover: '#22D3EE', // Cyan-400
          danger: '#EF4444',
        }
      }
    }
  },
  plugins: [],
}

