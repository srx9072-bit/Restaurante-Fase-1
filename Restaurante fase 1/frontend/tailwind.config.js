/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Nunito', 'system-ui', 'sans-serif'], titulo: ['Fraunces', 'Georgia', 'serif'] },
      colors: {
        fondo: '#FAF4EA',          // crema
        tinta: '#33231A',          // café oscuro (texto)
        tenue: '#6F5B4D',
        borde: '#E8DAC6',
        cafe: { DEFAULT: '#7B4A24', oscuro: '#5E3818', suave: '#F3E4D0', espresso: '#2A1B14' },
        hoja: { DEFAULT: '#3E7240', oscuro: '#2D5A30', suave: '#E3EFDD' },
        maiz: { DEFAULT: '#8A5A00', suave: '#FBEFCF' },
        aji: { DEFAULT: '#B8322A', suave: '#F9DEDA' },
      },
      boxShadow: { suave: '0 1px 2px rgba(60,35,20,.06), 0 4px 14px rgba(60,35,20,.06)' },
    },
  },
  plugins: [],
};
