# Sistema de gestión para restaurante: Fase 1

Carta con disponibilidad de platos según los ingredientes en stock, inventario, proveedores, clientes, recetas y usuarios con roles.

**Stack:** React + Vite + Tailwind, Node + Express, PostgreSQL.

## Correrlo en tu computadora

Necesitas Node 18 o superior y PostgreSQL encendido.

```bash
createdb restaurante                 # o créala desde pgAdmin

cd backend
cp .env.example .env                 # edita DB_PASSWORD y JWT_SECRET
npm install
npm run seed                         # crea las tablas y carga la carta de LESOFT y usuarios de ejemplo
                                     # si ya había datos: npm run seed -- --reset
npm run dev                          # http://localhost:3001

# otra terminal
cd frontend
cp .env.example .env
npm install
npm run dev                          # http://localhost:5173
```

Las tablas se crean solas al iniciar el servidor, no hace falta correr el esquema a mano.

## Publicarlo en Render

1. Sube la carpeta completa (con `render.yaml` en la raíz) a un repositorio de GitHub. El archivo `.gitignore` ya evita subir `node_modules` y `.env`.
2. En Render: **New > Blueprint**, elige el repositorio y aplica. Crea el servicio web y la base PostgreSQL.
3. Cuando te lo pida, escribe `CLAVE_INICIAL`: será la contraseña de los usuarios de ejemplo. No dejes `admin123` en un sitio público.
4. Al terminar el primer despliegue, entra a la dirección `.onrender.com` con `admin@restaurante.com` y esa clave.

Limitaciones del plan gratuito de Render, según su documentación:
- La base de datos gratuita **vence a los 30 días**, no tiene respaldos y solo se permite una por cuenta.
- El servicio web se duerme cuando pasa un rato sin visitas, y la primera carga después tarda más.
- No hay acceso a la consola (shell) en servicios gratuitos.

Si el sistema pasa a producción con un restaurante real, hay que subir ambos a un plan de pago para tener respaldos y que no se duerma.

## Usuarios de ejemplo

| Rol | Correo | Contraseña inicial | Puede |
|---|---|---|---|
| Administrador | admin@restaurante.com | admin123 (o `CLAVE_INICIAL`) | Todo |
| Caja | caja@restaurante.com | caja123 (o `CLAVE_INICIAL`) | Ver todo y gestionar clientes |
| Cocina | cocina@restaurante.com | cocina123 (o `CLAVE_INICIAL`) | Ver todo y ajustar el stock |

## Datos de ejemplo

La carta es la de LESOFT (restaurante de prueba). Los ingredientes y las cantidades de cada receta son **estimados**: hay que ajustarlos con la cocina real. Para otro restaurante, cambia los datos en `backend/src/seed.js` o cárgalos desde las pantallas de Inventario y Platos.

## Cómo funciona la disponibilidad

Cada plato tiene una receta (cuánto lleva de cada insumo por porción). La API calcula cuántas porciones alcanzan con el stock actual:

- Si falta algún ingrediente, el plato aparece como **No disponible** y se muestra qué falta.
- Si alcanzan 5 porciones o menos, aparece como **Quedan pocas**.
- Un plato sin receta aparece como disponible.

El stock cambia con "Ajustar stock" (entrada, salida o conteo). Cada cambio queda guardado en `movimientos_inventario` con el usuario que lo hizo. En la Fase 2, los pedidos descontarán el stock automáticamente.

## Estructura

```
render.yaml  Despliegue en Render
backend/     API (rutas en src/routes, esquema en sql/schema.sql)
frontend/    Interfaz (páginas en src/paginas)
```
