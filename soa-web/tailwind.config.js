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
        // Soil of Africa brand colors - Beige theme
        soa: {
          primary: '#8B7355',    // Warm brown (was forest green)
          secondary: '#C4A052',  // Gold/mustard
          accent: '#D4B896',     // Light beige
          dark: '#5D4E37',       // Dark brown
          light: '#F5F0E8',      // Cream/off-white background
          gold: '#C4A052',       // Mustard/gold from SOA shirt
          beige: '#E8DFD0',      // Main beige
          khaki: '#A89078',      // Mid-tone earth
          cream: '#FAF7F2',      // Lightest cream
          sand: '#D9CDBF',       // Sandy beige
          earth: '#6B5B4F',      // Earthy brown
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
