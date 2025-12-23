/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Soil of Africa brand colors
        soa: {
          primary: '#166534',    // Forest green
          secondary: '#22C55E',  // Bright green
          accent: '#84CC16',     // Lime
          dark: '#14532D',       // Dark green
          light: '#DCFCE7',      // Light green
          gold: '#C4A052',       // Mustard/gold from SOA shirt
          beige: '#D4B896',      // Lighter beige accent
          khaki: '#8B7355',      // Darker earth tone
        },
        // EduDash Pro accent
        edudash: {
          primary: '#6366F1',    // Indigo
          secondary: '#8B5CF6',  // Purple
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
