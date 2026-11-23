/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Nunito', 'system-ui', 'sans-serif'] },
      colors: {
        fondo: '#F2F5F1',
        tinta: '#18302A',
        tenue: '#566B62',
        borde: '#D3DCD5',
        hoja: { DEFAULT: '#1E7A57', oscuro: '#166247', suave: '#DDEFE5' },
        maiz: { DEFAULT: '#8A5A00', suave: '#FBEFCF' },
        aji: { DEFAULT: '#B8322A', suave: '#F9DEDA' },
      },
    },
  },
  plugins: [],
};
