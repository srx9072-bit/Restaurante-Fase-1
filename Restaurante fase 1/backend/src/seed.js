// Carga la carta de LESOFT (restaurante de prueba) con ingredientes y recetas de EJEMPLO.
// Las cantidades de las recetas son estimadas: hay que ajustarlas con quien conozca la cocina.
// Uso:  npm run seed            (solo si la base está vacía)
//       npm run seed -- --reset (borra todo y vuelve a cargar)
// Si defines CLAVE_INICIAL, esa será la contraseña de los 3 usuarios de ejemplo.
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { pool, insertarVarios, aplicarEsquema } from './db.js';

// proveedor -> [nombre, unidad, stock, stock mínimo]
const PROVEEDORES = {
  'Carnes y Aves San José': [
    ['Carne molida', 'lb', 20, 8], ['Carne de res', 'lb', 15, 6], ['Carne de cerdo', 'lb', 12, 5],
    ['Pierna horneada', 'lb', 0, 4], ['Pollo', 'lb', 25, 10], ['Alitas de pollo', 'lb', 20, 8],
    ['Jamón', 'lb', 4, 2], ['Tocino', 'lb', 3, 2],
  ],
  'Verduras y Frutas del Valle': [
    ['Lechuga', 'unidad', 12, 4], ['Tomate', 'lb', 15, 6], ['Cebolla', 'lb', 12, 5], ['Aguacate', 'unidad', 15, 6],
    ['Pepinillos', 'lb', 3, 1], ['Piña', 'unidad', 6, 2], ['Papas', 'lb', 40, 15], ['Frijol', 'lb', 10, 4],
    ['Fresa', 'lb', 1, 3], ['Banano', 'unidad', 30, 10], ['Melocotón', 'lb', 5, 2], ['Naranja', 'unidad', 40, 15],
    ['Limón', 'unidad', 50, 20],
  ],
  'Lácteos La Granja': [
    ['Queso mozzarella', 'lb', 8, 3], ['Queso chedar', 'lb', 5, 2], ['Crema', 'lb', 6, 2], ['Leche', 'litro', 30, 10],
    ['Huevos', 'unidad', 90, 30], ['Helado', 'litro', 10, 4], ['Leche condensada', 'lb', 4, 2],
  ],
  'Panadería La Espiga': [
    ['Pan de hamburguesa', 'unidad', 40, 15], ['Pan artesanal', 'unidad', 30, 10], ['Tortillas', 'unidad', 150, 60],
    ['Tostadas de maíz', 'unidad', 60, 20], ['Masa de dumpling', 'unidad', 60, 20], ['Pan tostado', 'unidad', 40, 15],
    ['Mezcla para crepas', 'lb', 10, 4], ['Mezcla para waffle y panqueques', 'lb', 12, 4],
  ],
  'Distribuidora de Bebidas y Abarrotes': [
    ['Café molido', 'lb', 8, 3], ['Cocoa en polvo', 'lb', 5, 2], ['Marshmallows', 'lb', 0.1, 1], ['Té de durazno', 'unidad', 50, 20],
    ['Té chai', 'lb', 2, 1], ['Tiste', 'lb', 4, 2], ['Chía', 'lb', 2, 1], ['Azúcar', 'lb', 25, 10], ['Hielo', 'lb', 60, 20],
    ['Soda', 'unidad', 48, 24], ['Agua pura', 'unidad', 60, 24], ['Jarabe de sabores (poping)', 'litro', 4, 2],
    ['Jarabe de chocolate', 'litro', 3, 1], ['Jarabe de caramelo', 'litro', 3, 1], ['Crema de coco', 'lb', 3, 1],
    ['Galletas Oreo', 'unidad', 40, 15], ['Algodón de azúcar', 'unidad', 20, 8], ['Nutella', 'lb', 4, 2],
    ['Dulce de leche', 'lb', 4, 2], ['Granola', 'lb', 3, 1], ['Aderezo especial', 'litro', 3, 1], ['Mayonesa', 'lb', 4, 2],
    ['Salsas (pastor y mesa)', 'litro', 4, 2], ['Salsa barbacoa', 'litro', 2, 1], ['Salsa búfalo', 'litro', 2, 1],
    ['Escabeche', 'lb', 3, 1], ['Salsa de soya', 'litro', 0.02, 1],
  ],
};

// nombre, categoría, precio, descripción, receta "insumo:cantidad por porción, ..."
const PLATOS = [
  ['Crepa de fresa', 'Crepas', 35, 'Crea tu crepa: dulce de leche, Nutella o crema de la casa', 'Mezcla para crepas:0.15, Fresa:0.2'],
  ['Crepa de banano', 'Crepas', 35, 'Crea tu crepa: dulce de leche, Nutella o crema de la casa', 'Mezcla para crepas:0.15, Banano:1'],
  ['Crepa de melocotón', 'Crepas', 35, 'Crea tu crepa: dulce de leche, Nutella o crema de la casa', 'Mezcla para crepas:0.15, Melocotón:0.2'],
  ['Crepa mixta', 'Crepas', 40, 'Crea tu crepa: dulce de leche, Nutella o crema de la casa', 'Mezcla para crepas:0.15, Fresa:0.1, Banano:0.5, Melocotón:0.1'],

  ['Café americano', 'Bebidas calientes', 15, null, 'Café molido:0.03, Azúcar:0.01'],
  ['Café de la casa', 'Bebidas calientes', 10, null, 'Café molido:0.03, Azúcar:0.01'],
  ['Capuccino', 'Bebidas calientes', 20, null, 'Café molido:0.04, Leche:0.2'],
  ['Chocolate', 'Bebidas calientes', 15, null, 'Cocoa en polvo:0.05, Leche:0.25, Azúcar:0.02'],
  ['Cocoa simple', 'Bebidas calientes', 15, null, 'Cocoa en polvo:0.04, Azúcar:0.02'],
  ["Cocoa con mashmallow's", 'Bebidas calientes', 20, null, 'Cocoa en polvo:0.04, Azúcar:0.02, Marshmallows:0.03'],

  ['Poping Soda', 'Sodas y refrescos', 25, 'Manzana verde, blueberry, sandía, kiwi o cereza', 'Soda:1, Jarabe de sabores (poping):0.05, Hielo:0.3'],
  ['Naranjada con soda', 'Sodas y refrescos', 20, null, 'Naranja:3, Soda:1, Azúcar:0.02, Hielo:0.3'],
  ['Sodas', 'Sodas y refrescos', 10, null, 'Soda:1'],
  ['Limonada con chía', 'Sodas y refrescos', 15, null, 'Limón:4, Chía:0.02, Azúcar:0.05, Hielo:0.3'],
  ['Tiste', 'Sodas y refrescos', 15, null, 'Tiste:0.08, Azúcar:0.03, Hielo:0.3'],
  ['Té frío de durazno', 'Sodas y refrescos', 15, null, 'Té de durazno:1, Azúcar:0.04, Hielo:0.3'],
  ['Botella de agua pura', 'Sodas y refrescos', 7, null, 'Agua pura:1'],

  ['Piña colada (sin licor)', 'Bebidas con hielo', 30, null, 'Piña:0.25, Crema de coco:0.1, Azúcar:0.03, Hielo:0.4'],
  ['Licuado de fresa', 'Bebidas con hielo', 20, null, 'Fresa:0.25, Leche:0.25, Azúcar:0.03, Hielo:0.3'],
  ['Moka Frappe', 'Bebidas con hielo', 23, null, 'Café molido:0.04, Jarabe de chocolate:0.05, Leche:0.2, Hielo:0.4'],
  ['Oreo Frappe', 'Bebidas con hielo', 25, null, 'Galletas Oreo:3, Leche:0.25, Hielo:0.4'],
  ['Caramel Frappe', 'Bebidas con hielo', 30, null, 'Café molido:0.04, Jarabe de caramelo:0.06, Leche:0.2, Hielo:0.4'],
  ['Algodón de azúcar Frappe', 'Bebidas con hielo', 30, null, 'Algodón de azúcar:1, Leche:0.25, Hielo:0.4'],

  ['Ice latte', 'Lattes', 20, null, 'Café molido:0.04, Leche:0.25, Hielo:0.3'],
  ['Spanish latte', 'Lattes', 25, null, 'Café molido:0.04, Leche:0.2, Leche condensada:0.05, Hielo:0.3'],
  ['Latte nutella', 'Lattes', 25, null, 'Café molido:0.04, Leche:0.25, Nutella:0.05'],
  ['Latte Chai', 'Lattes', 20, null, 'Té chai:0.03, Leche:0.25'],

  ['Hamburguesa de la casa', 'Salados de pan', 45, 'Carne, queso mozzarella, cebolla caramelizada y aderezo especial, con papas fritas',
    'Pan de hamburguesa:1, Carne molida:0.25, Queso mozzarella:0.1, Cebolla:0.1, Aderezo especial:0.03, Papas:0.4'],
  ['Hamburguesa doble', 'Salados de pan', 60, 'Doble carne, doble queso, lechuga, cebolla caramelizada y aderezo especial, con papas fritas',
    'Pan de hamburguesa:1, Carne molida:0.5, Queso mozzarella:0.2, Lechuga:0.1, Cebolla:0.1, Aderezo especial:0.03, Papas:0.4'],
  ['Sandwich de pierna horneada', 'Salados de pan', 30, 'Pan artesanal, pierna horneada, tomate, cebolla, lechuga, aguacate, queso y aderezo de la casa',
    'Pan artesanal:1, Pierna horneada:0.2, Tomate:0.1, Cebolla:0.05, Lechuga:0.1, Aguacate:0.25, Queso mozzarella:0.05, Aderezo especial:0.03'],
  ['Sandwich de pollo', 'Salados de pan', 25, 'Pollo desmenuzado con mayonesa, lechuga, tomate, cebolla y pepinillos',
    'Pan artesanal:1, Pollo:0.2, Mayonesa:0.03, Lechuga:0.1, Tomate:0.1, Cebolla:0.05, Pepinillos:0.03'],

  ['Tacos al pastor', 'Salados de maíz', 35, 'Carne de cerdo, pico de gallo, piña y salsas',
    'Tortillas:3, Carne de cerdo:0.25, Piña:0.05, Tomate:0.1, Cebolla:0.05, Salsas (pastor y mesa):0.05'],
  ['Tacos de res', 'Salados de maíz', 35, 'Carne de res, pico de gallo y salsas',
    'Tortillas:3, Carne de res:0.25, Tomate:0.1, Cebolla:0.05, Salsas (pastor y mesa):0.05'],
  ['Flautas de pollo', 'Salados de maíz', 30, 'Tacos dorados con lechuga, tomate, cebolla, crema, queso y salsa verde',
    'Tortillas:3, Pollo:0.2, Lechuga:0.1, Tomate:0.1, Cebolla:0.05, Crema:0.05, Queso mozzarella:0.05, Salsas (pastor y mesa):0.05'],
  ['Chalupas', 'Salados de maíz', 30, 'Tostadas con frijol, pollo desmenuzado y lechuga',
    'Tostadas de maíz:3, Frijol:0.15, Pollo:0.15, Lechuga:0.1'],
  ['Huevos motuleños', 'Salados de maíz', 30, 'Huevos estrellados sobre una tortilla, con jamón, frijol, crema y queso',
    'Tortillas:1, Huevos:2, Jamón:0.05, Frijol:0.1, Crema:0.05, Queso mozzarella:0.05'],

  ['Alitas Barbacoa-Búfalo', 'Otros', 45, 'Alitas bañadas al gusto, con papas fritas',
    'Alitas de pollo:0.5, Salsa barbacoa:0.05, Salsa búfalo:0.05, Papas:0.4'],
  ['Alitas Scabeche', 'Otros', 45, 'Alitas bañadas en escabeche, con papas fritas', 'Alitas de pollo:0.5, Escabeche:0.15, Papas:0.4'],
  ['Porción de papas simples', 'Otros', 15, null, 'Papas:0.4'],
  ['Papas chedar', 'Otros', 30, 'Porción de papas con queso chedar y tocino', 'Papas:0.4, Queso chedar:0.15, Tocino:0.05'],
  ['Dumplings', 'Otros', 25, 'Relleno de carne envuelto en una fina capa de masa, con salsa de soya',
    'Masa de dumpling:6, Carne molida:0.2, Salsa de soya:0.03'],
  ['Carpaccio', 'Otros', 75, 'Finas láminas de carne marinada con pan tostado', 'Carne de res:0.25, Pan tostado:2, Aderezo especial:0.03'],

  ['Waffle', 'Dulces', 35, 'Incluye fruta, syrup de chocolate, granola y una bola de helado (extra helado: +Q5)',
    'Mezcla para waffle y panqueques:0.15, Huevos:1, Banano:1, Jarabe de chocolate:0.05, Granola:0.05, Helado:0.1'],
  ['Panqueques', 'Dulces', 30, 'Incluye fruta, syrup de chocolate y granola',
    'Mezcla para waffle y panqueques:0.2, Huevos:1, Banano:1, Jarabe de chocolate:0.05, Granola:0.05'],
  ['Tostadas Francesas', 'Dulces', 25, 'Fruta y syrup de caramelo', 'Pan tostado:2, Huevos:1, Leche:0.05, Banano:1, Jarabe de caramelo:0.05'],
];

export async function sembrar({ reset = false } = {}) {
  if (reset) {
    await pool.query('TRUNCATE plato_ingredientes, movimientos_inventario, platos, insumos, clientes, proveedores, usuarios, mesas, cajas RESTART IDENTITY CASCADE');
  } else {
    const { rows } = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    if (rows[0].total > 0) return 'La base de datos ya tiene datos. Usa "npm run seed -- --reset" para borrar todo y recargar.';
  }

  const clave = (porDefecto) => bcrypt.hash((process.env.CLAVE_INICIAL || '').trim() || porDefecto, 10);
  await insertarVarios(pool, 'usuarios', ['nombre', 'email', 'password_hash', 'rol'], [
    ['Administrador', 'admin@restaurante.com', await clave('admin123'), 'admin'],
    ['Caja', 'caja@restaurante.com', await clave('caja123'), 'cajero'],
    ['Cocina', 'cocina@restaurante.com', await clave('cocina123'), 'cocina'],
  ]);

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
