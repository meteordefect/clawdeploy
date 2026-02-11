/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        surface: '#FAFAFA',
        card: '#FFFFFF',
        subtle: '#F5F5F7',
        
        // Text
        primary: '#1D1D1F',
        secondary: '#6E6E73',
        tertiary: '#A1A1A6',
        
        // Accents
        accent: {
          DEFAULT: '#1E3A5F', // Midnight Blue
          dark: '#152A45',
          light: '#2D4A6F',
        },
        
        // Status
        working: '#1E3A5F',
        review: '#7C3AED',
        done: '#059669',
        waiting: '#F59E0B',
        
        // Standard Semantic (keeping these for compatibility but mapped to design system)
        success: '#059669',
        warning: '#F59E0B',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
        'card-hover': '0 4px 6px rgba(0,0,0,0.05), 0 12px 24px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      }
    },
  },
  plugins: [],
}
