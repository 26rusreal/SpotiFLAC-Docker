/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          850: "#0f172a",
          950: "#020617"
        }
      },
      keyframes: {
        fade: {
          from: { opacity: 0 },
          to: { opacity: 1 }
        }
      },
      animation: {
        fade: "fade 0.4s ease-in-out"
      }
    }
  },
  plugins: []
};
