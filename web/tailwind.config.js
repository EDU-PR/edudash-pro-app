/** @type {import('tailwindcss').Config} */
export const content = [
  './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  './src/app/**/*.{js,ts,jsx,tsx,mdx}',
];
export const theme = {
  extend: {
    colors: {
      gray: {
        750: '#1a1f2e',
      },
      slate: {
        750: '#293548',
      },
    },
    backdropBlur: {
      xs: '2px',
    },
    transitionTimingFunction: {
      'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
};
export const plugins = [];
