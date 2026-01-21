/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#14b8a5",
        "primary-dark": "#0d9485",
        "brand-navy": "#0F172A",
        
        background: "#F8FAFC",
        "background-dark": "#11211f",
        
        "status-good": "#10B981",
        "status-warn": "#F59E0B",
        "status-danger": "#EF4444",
        "status-amber": "#F59E0B",
        "status-red": "#EF4444",
        
        "text-main": "#1E293B",
        "text-sub": "#64748B",
        "border": "#E2E8F0",
      },
      fontFamily: {
        sans: ["System"], 
        mono: ["System"],
      },
    },
  },
  plugins: [],
}