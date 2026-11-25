// Carga la carta de Coffee Lovers con ingredientes y recetas de EJEMPLO.
// Las cantidades de las recetas son estimadas: hay que ajustarlas con quien conozca la cocina.
// Uso:  npm run seed            (solo si la base está vacía)
//       npm run seed -- --reset (borra todo y vuelve a cargar)
// Si defines CLAVE_INICIAL, esa será la contraseña de los 3 usuarios de ejemplo.
// PIN de ejemplo para cambiar de usuario: Administrador 1111, Caja 2222, Cocina 3333.
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { pool, insertarVarios, aplicarEsquema } from './db.js';

// proveedor -> [nombre, unidad, stock, stock mínimo]
// Los proveedores, el stock y las recetas son de EJEMPLO: se corrigen desde Inventario y Platos.
const PROVEEDORES = {
  'Café y Té de Altura': [
    ['Café molido', 'lb', 10, 3], ['Cardamomo', 'lb', 2, 0.5], ['Té chai', 'lb', 2, 0.5],
    ['Té (bolsitas variedad)', 'unidad', 80, 20], ['Té verde', 'unidad', 50, 15], ['Té negro', 'unidad', 50, 15],
    ['Manzanilla', 'unidad', 50, 15], ['Tiste', 'lb', 4, 1], ['Cocoa en polvo', 'lb', 5, 2],
  ],
  'Lácteos La Granja': [
    ['Leche', 'litro', 30, 10], ['Leche deslactosada', 'litro', 8, 3], ['Helado de vainilla', 'litro', 8, 3],
    ['Crema batida', 'litro', 3, 1], ['Queso cheddar', 'unidad', 60, 20], ['Queso americano', 'unidad', 30, 10],
    ['Queso mozzarella', 'lb', 6, 2], ['Salsa de queso', 'litro', 4, 1], ['Huevos', 'unidad', 60, 20],
  ],
  'Carnes y Embutidos San José': [
    ['Torta de carne', 'unidad', 40, 15], ['Torta de carne 7 oz', 'unidad', 12, 5], ['Tocino', 'lb', 5, 2],
    ['Salchichas', 'unidad', 40, 15], ['Carne molida', 'lb', 12, 4], ['Carne de res', 'lb', 8, 3], ['Jamón', 'lb', 4, 1.5],
  ],
  'Panadería La Espiga': [
    ['Pan de hamburguesa', 'unidad', 40, 15], ['Pan de hot dog', 'unidad', 30, 10], ['Pan de sándwich', 'unidad', 60, 20],
    ['Tortillas de harina', 'unidad', 60, 20], ['Totopos', 'lb', 8, 3],
  ],
  'Verduras y Frutas del Valle': [
    ['Lechuga', 'unidad', 10, 3], ['Tomate', 'lb', 12, 4], ['Cebolla', 'lb', 8, 3], ['Pepinillos', 'lb', 4, 1],
    ['Aguacate', 'unidad', 12, 4], ['Frijol', 'lb', 8, 3], ['Fresa', 'lb', 0.4, 2], ['Frutas variadas', 'lb', 10, 4],
    ['Limón', 'unidad', 60, 20], ['Papas', 'lb', 40, 15], ['Hash brown', 'unidad', 30, 10],
  ],
  'Distribuidora de Bebidas y Abarrotes': [
    ['Azúcar', 'lb', 25, 8], ['Hielo', 'lb', 60, 20], ['Jarabe de vainilla', 'litro', 2, 0.5],
    ['Jarabe de caramelo', 'litro', 2, 0.5], ['Jarabe de cardamomo', 'litro', 1, 0.3], ['Jarabe de chocolate', 'litro', 3, 1],
    ['Jarabe de menta', 'litro', 1.5, 0.5], ['Jarabe para soda italiana', 'litro', 3, 1], ['Polvo para pink latte', 'lb', 2, 0.5],
    ['Marshmallows', 'lb', 2, 0.5], ['Galletas Oreo', 'unidad', 40, 12], ['Agua mineral', 'unidad', 48, 12],
    ['Gaseosas', 'unidad', 72, 24], ['Agua pura', 'unidad', 48, 12], ['Aderezo especial', 'litro', 3, 1],
    ['Salsa barbacoa', 'litro', 2, 0.5], ['Salsa chipotle', 'litro', 2, 0.5], ['Mayonesa', 'lb', 4, 1],
    ['Salsas para mineral', 'litro', 1, 0.3], ['Sal', 'lb', 5, 1],
  ],
};

// nombre, categoría, precio, descripción, receta "insumo:cantidad por porción, ..."
const PAPAS = 'Papas:0.35';
const PLATOS = [
  // ---------- Bebidas calientes ----------
  ['Café Guatemalteco pequeño', 'Calientes con café', 12, null, 'Café molido:0.03, Azúcar:0.01'],
  ['Café Guatemalteco grande', 'Calientes con café', 14, null, 'Café molido:0.04, Azúcar:0.015'],
  ['Café con Cardamomo grande', 'Calientes con café', 15, null, 'Café molido:0.04, Cardamomo:0.005, Azúcar:0.015'],
  ['Capuchino pequeño', 'Calientes con café', 15, null, 'Café molido:0.03, Leche:0.15'],
  ['Capuchino grande', 'Calientes con café', 20, null, 'Café molido:0.04, Leche:0.25'],
  ['Espresso', 'Calientes con café', 10, null, 'Café molido:0.02'],
  ['Espresso doble', 'Calientes con café', 14, null, 'Café molido:0.04'],
  ['Afogatto', 'Calientes con café', 22, 'Espresso sobre una bola de helado de vainilla', 'Café molido:0.02, Helado de vainilla:0.1'],
  ['Mocaccino grande', 'Calientes con café', 22, null, 'Café molido:0.04, Leche:0.25, Jarabe de chocolate:0.04'],

  ['Capuchino Vainilla', 'Capuchinos saborizados', 22, null, 'Café molido:0.04, Leche:0.25, Jarabe de vainilla:0.03'],
  ['Capuchino Caramelo', 'Capuchinos saborizados', 22, null, 'Café molido:0.04, Leche:0.25, Jarabe de caramelo:0.03'],
  ['Capuchino Cardamomo', 'Capuchinos saborizados', 22, null, 'Café molido:0.04, Leche:0.25, Jarabe de cardamomo:0.03'],

  ['Pink Latte', 'Calientes sin café', 20, null, 'Polvo para pink latte:0.03, Leche:0.25'],
  ['Chai latte', 'Calientes sin café', 20, null, 'Té chai:0.03, Leche:0.25'],
  ['Chocomenta', 'Calientes sin café', 22, null, 'Cocoa en polvo:0.04, Jarabe de menta:0.03, Leche:0.25'],
  ['Cocoa simple', 'Calientes sin café', 15, null, 'Cocoa en polvo:0.04, Leche:0.25, Azúcar:0.02'],
  ['Cocoa con Marshmallow', 'Calientes sin café', 20, null, 'Cocoa en polvo:0.04, Leche:0.25, Azúcar:0.02, Marshmallows:0.03'],
  ['Té (variedad)', 'Calientes sin café', 8, null, 'Té (bolsitas variedad):1, Azúcar:0.01'],

  // ---------- Bebidas frías ----------
  ['Moka Frappé', 'Frappés', 22, null, 'Café molido:0.04, Jarabe de chocolate:0.05, Leche:0.2, Hielo:0.4'],
  ['Oreo Frappé', 'Frappés', 24, null, 'Galletas Oreo:3, Leche:0.25, Hielo:0.4, Crema batida:0.03'],
  ['Caramelo Frappé', 'Frappés', 24, null, 'Café molido:0.04, Jarabe de caramelo:0.05, Leche:0.2, Hielo:0.4'],
  ['Frappé Chai', 'Frappés', 25, null, 'Té chai:0.03, Leche:0.25, Hielo:0.4'],

  ['Iced Coffee', 'Frías con café', 18, 'Café + hielo', 'Café molido:0.04, Azúcar:0.015, Hielo:0.3'],
  ['Iced Latte', 'Frías con café', 20, 'Café + leche + hielo', 'Café molido:0.04, Leche:0.2, Hielo:0.3'],
  ['Iced Latte Caramelo', 'Frías con café', 23, null, 'Café molido:0.04, Leche:0.2, Jarabe de caramelo:0.03, Hielo:0.3'],

  ['Iced choco Menta', 'Frías sin café', 24, null, 'Cocoa en polvo:0.04, Jarabe de menta:0.03, Leche:0.25, Hielo:0.3'],
  ['Vainilla Iced', 'Frías sin café', 15, null, 'Leche:0.25, Jarabe de vainilla:0.03, Hielo:0.3'],
  ['Soda Italiana (variedad)', 'Frías sin café', 15, null, 'Agua mineral:1, Jarabe para soda italiana:0.04, Hielo:0.3'],
  ['Malteada pequeña (variedad)', 'Frías sin café', 20, null, 'Helado de vainilla:0.2, Leche:0.15, Crema batida:0.03'],
  ['Malteada grande (variedad)', 'Frías sin café', 24, null, 'Helado de vainilla:0.3, Leche:0.2, Crema batida:0.04'],
  ['Vaca negra', 'Frías sin café', 25, 'Gaseosa con helado de vainilla', 'Gaseosas:1, Helado de vainilla:0.15'],

  ['Licuado de frutas', 'Naturales', 15, null, 'Frutas variadas:0.3, Leche:0.2, Azúcar:0.03, Hielo:0.2'],
  ['Licuado de fresa', 'Naturales', 20, null, 'Fresa:0.25, Leche:0.2, Azúcar:0.03, Hielo:0.2'],
  ['Tiste', 'Naturales', 10, null, 'Tiste:0.08, Azúcar:0.03, Hielo:0.3'],
  ['Tiste con Leche', 'Naturales', 15, null, 'Tiste:0.08, Leche:0.25, Azúcar:0.03, Hielo:0.2'],
  ['Limonada', 'Naturales', 10, 'Sujeto a disponibilidad', 'Limón:4, Azúcar:0.05, Hielo:0.3'],

  ['Té verde frío', 'Té frío', 15, null, 'Té verde:1, Azúcar:0.03, Hielo:0.3'],
  ['Té negro frío', 'Té frío', 15, null, 'Té negro:1, Azúcar:0.03, Hielo:0.3'],
  ['Manzanilla fría', 'Té frío', 15, null, 'Manzanilla:1, Azúcar:0.03, Hielo:0.3'],

  ['Mineral Preparada', 'Otras bebidas', 25, 'Sujeto a disponibilidad', 'Agua mineral:1, Limón:2, Sal:0.01, Salsas para mineral:0.03, Hielo:0.2'],
  ['Gaseosas (variedad)', 'Otras bebidas', 10, null, 'Gaseosas:1'],
  ['Agua pura (botella)', 'Otras bebidas', 7, null, 'Agua pura:1'],

  // ---------- Hamburguesas (todas incluyen papas) ----------
  ['Hamburguesa clásica', 'Hamburguesas', 35, 'Torta de carne, cheddar, lechuga, tomate, pepinillos y nuestro aderezo especial. Incluye papas',
    `Pan de hamburguesa:1, Torta de carne:1, Queso cheddar:1, Lechuga:0.1, Tomate:0.08, Pepinillos:0.03, Aderezo especial:0.03, ${PAPAS}`],
  ['Hamburguesa doble', 'Hamburguesas', 52, 'Doble torta de carne, doble cheddar, lechuga, tomate, pepinillos y nuestro aderezo especial. Incluye papas',
    `Pan de hamburguesa:1, Torta de carne:2, Queso cheddar:2, Lechuga:0.1, Tomate:0.08, Pepinillos:0.03, Aderezo especial:0.03, ${PAPAS}`],
  ['Torito', 'Hamburguesas', 45, 'Torta de carne, tocino, huevo, cheddar, lechuga, tomate, pepinillos y nuestro aderezo especial. Incluye papas',
    `Pan de hamburguesa:1, Torta de carne:1, Tocino:0.06, Huevos:1, Queso cheddar:1, Lechuga:0.1, Tomate:0.08, Pepinillos:0.03, Aderezo especial:0.03, ${PAPAS}`],

  ['Doble Suprema', 'Hamburguesas especiales', 65, 'Doble torta de carne, doble tocino, queso americano, mozzarella, huevo, lechuga fresca, tomate y nuestro aderezo especial. Incluye papas',
    `Pan de hamburguesa:1, Torta de carne:2, Tocino:0.12, Queso americano:1, Queso mozzarella:0.06, Huevos:1, Lechuga:0.1, Tomate:0.08, Aderezo especial:0.03, ${PAPAS}`],
  ['Rellena', 'Hamburguesas especiales', 55, 'Torta de carne de 7 oz. rellena de queso mozzarella, tocino, huevo, lechuga fresca, tomate, pepinillos y nuestro aderezo especial. Incluye papas',
    `Pan de hamburguesa:1, Torta de carne 7 oz:1, Queso mozzarella:0.08, Tocino:0.06, Huevos:1, Lechuga:0.1, Tomate:0.08, Pepinillos:0.03, Aderezo especial:0.03, ${PAPAS}`],
  ['BBQ', 'Hamburguesas especiales', 50, 'Torta de carne bañada en salsa barbacoa, doble tocino, tomate y pepinillos. Incluye papas',
    `Pan de hamburguesa:1, Torta de carne:1, Salsa barbacoa:0.04, Tocino:0.12, Tomate:0.08, Pepinillos:0.03, ${PAPAS}`],
  ['Chipotle', 'Hamburguesas especiales', 50, 'Hamburguesa picante con tocino, huevo, pepinillos, lechuga fresca y tomate. Incluye papas',
    `Pan de hamburguesa:1, Torta de carne:1, Salsa chipotle:0.04, Tocino:0.06, Huevos:1, Pepinillos:0.03, Lechuga:0.1, Tomate:0.08, ${PAPAS}`],

  ['Extra Tocino', 'Extras para hamburguesa', 5, null, 'Tocino:0.06'],
  ['Extra Cheddar', 'Extras para hamburguesa', 3, null, 'Queso cheddar:1'],
  ['Extra Mozzarella', 'Extras para hamburguesa', 5, null, 'Queso mozzarella:0.06'],

  // ---------- Snacks ----------
  ['Hot Dog', 'Snacks', 20, null, 'Pan de hot dog:1, Salchichas:1, Mayonesa:0.02'],
  ['Chilli Dog', 'Snacks', 25, null, 'Pan de hot dog:1, Salchichas:1, Carne molida:0.08, Frijol:0.05, Salsa de queso:0.03'],
  ['Chilli Nachos', 'Snacks', 28, null, 'Totopos:0.25, Carne molida:0.1, Frijol:0.08, Salsa de queso:0.06'],
  ['Chilli Papas', 'Snacks', 30, null, 'Papas:0.4, Carne molida:0.1, Frijol:0.08, Salsa de queso:0.06'],
  ['Nachos con carne', 'Snacks', 30, null, 'Totopos:0.25, Carne molida:0.15, Salsa de queso:0.06, Tomate:0.05'],
  ['Salchi Papas', 'Snacks', 40, null, 'Papas:0.5, Salchichas:2, Mayonesa:0.02'],
  ['Sándwich', 'Snacks', 25, null, 'Pan de sándwich:2, Jamón:0.08, Queso cheddar:1, Lechuga:0.05, Tomate:0.05, Mayonesa:0.02'],
  ['Sándwich especial', 'Snacks', 35, null, 'Pan de sándwich:2, Jamón:0.1, Tocino:0.05, Huevos:1, Queso cheddar:1, Aguacate:0.5, Lechuga:0.05, Tomate:0.05'],
  ['Beef Burritos', 'Snacks', 30, null, 'Tortillas de harina:2, Carne de res:0.2, Frijol:0.08, Queso mozzarella:0.04, Cebolla:0.03'],
  ['Sincronizada mixta', 'Snacks', 25, null, 'Tortillas de harina:2, Jamón:0.08, Queso mozzarella:0.08'],
  ['Porción de Hash Brown', 'Snacks', 15, null, 'Hash brown:2'],
  ['Papas Simples', 'Snacks', 22, null, 'Papas:0.45, Sal:0.005'],
  ['Super nachos', 'Snacks', 55, 'Para compartir', 'Totopos:0.5, Carne molida:0.25, Frijol:0.15, Salsa de queso:0.12, Tomate:0.1, Cebolla:0.05, Aguacate:1'],
];

// Usuarios de ejemplo: nombre, correo, clave por defecto, rol, PIN para cambiar de usuario
const USUARIOS = [
  ['Administrador', 'admin@restaurante.com', 'admin123', 'admin', '1111'],
  ['Caja', 'caja@restaurante.com', 'caja123', 'cajero', '2222'],
  ['Cocina', 'cocina@restaurante.com', 'cocina123', 'cocina', '3333'],
];

export async function sembrar({ reset = false } = {}) {
  if (reset) {
    await pool.query('TRUNCATE pedido_items, pedidos, caja_movimientos, plato_ingredientes, movimientos_inventario, platos, insumos, clientes, proveedores, usuarios, mesas, cajas RESTART IDENTITY CASCADE');
  } else {
    const { rows } = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    if (rows[0].total > 0) return 'La base de datos ya tiene datos. Usa "npm run seed -- --reset" para borrar todo y recargar.';
  }

  const clave = (porDefecto) => bcrypt.hash((process.env.CLAVE_INICIAL || '').trim() || porDefecto, 10);
  const filasUsuarios = [];
  for (const [nombre, email, porDefecto, rol, pin] of USUARIOS) {
    filasUsuarios.push([nombre, email, await clave(porDefecto), rol, await bcrypt.hash(pin, 10)]);
  }
  await insertarVarios(pool, 'usuarios', ['nombre', 'email', 'password_hash', 'rol', 'pin_hash'], filasUsuarios);

  const insumoId = {};
  let n = 0;
  for (const [proveedor, lista] of Object.entries(PROVEEDORES)) {
    const { rows: [prov] } = await pool.query(
      'INSERT INTO proveedores (nombre, contacto, telefono) VALUES ($1, $2, $3) RETURNING id',
      [proveedor, 'Contacto de ejemplo', `5555-${1000 + ++n}`]);
    for (const [nombre, unidad, stock, minimo] of lista) {
      const { rows: [ins] } = await pool.query(
        'INSERT INTO insumos (nombre, unidad, stock, stock_minimo, proveedor_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [nombre, unidad, stock, minimo, prov.id]);
      insumoId[nombre] = ins.id;
    }
  }

  for (const [nombre, categoria, precio, descripcion, receta] of PLATOS) {
    const { rows: [plato] } = await pool.query(
      'INSERT INTO platos (nombre, categoria, precio, descripcion) VALUES ($1, $2, $3, $4) RETURNING id',
      [nombre, categoria, precio, descripcion]);
    const filas = receta.split(',').map((x) => {
      const [ing, cant] = x.split(':');
      const id = insumoId[ing.trim()];
      if (!id) throw new Error(`Insumo desconocido en "${nombre}": ${ing}`);
      return [plato.id, id, Number(cant)];
    });
    await insertarVarios(pool, 'plato_ingredientes', ['plato_id', 'insumo_id', 'cantidad'], filas);
  }

  await insertarVarios(pool, 'mesas', ['nombre', 'capacidad'], [
    ['Mesa 1', 2], ['Mesa 2', 2], ['Mesa 3', 4], ['Mesa 4', 4], ['Mesa 5', 4], ['Mesa 6', 6], ['Mesa 7', 6], ['Terraza', 4],
  ]);

  await insertarVarios(pool, 'clientes', ['nombre', 'telefono', 'notas'], [
    ['María López', '5555-4444', 'Prefiere mesa junto a la ventana'],
    ['Carlos Pérez', '5555-5555', null],
  ]);

  return `Listo: ${PLATOS.length} platos y ${Object.keys(insumoId).length} ingredientes cargados.`;
}

// Si se ejecuta directamente (npm run seed)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await aplicarEsquema();
  console.log(await sembrar({ reset: process.argv.includes('--reset') }));
  await pool.end();
}
