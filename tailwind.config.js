/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'emerald-deep': '#0F3D3E',
        'graphite': '#1E1E1E', 
        'teal-soft': '#5FB3A5',
        'neutral-light': '#F5F7F7'
      },
      fontFamily: {
        satoshi: ['Satoshi', 'sans-serif']
      }
    },
  },
  plugins: [],
}
