/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 启用基于class的深色模式
  theme: {
    extend: {
      colors: {
        primary: 'var(--accent)',
        background: 'var(--bg-primary)',
        surface: 'var(--bg-secondary)',
      },
    },
  },
  plugins: [],
}
