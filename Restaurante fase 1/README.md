# Sistema de gestión para restaurante

Carta con disponibilidad de platos según los ingredientes en stock, inventario, proveedores, clientes, recetas, usuarios con roles y pedidos.

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

El stock cambia con "Ajustar stock" (entrada, salida o conteo) y también con los pedidos. Cada cambio queda guardado en `movimientos_inventario` con el usuario que lo hizo.

## Pedidos (Fase 2)

- **Crear** (admin y caja): se eligen los platos, con una nota por plato (por ejemplo la base de la crepa, el sabor o "sin cebolla"), y si es para mesa, para llevar o a domicilio. Al crearlo, los ingredientes se descuentan del inventario. Si no alcanza el stock de algo, el pedido no se crea y se explica qué falta.
- **Estados:** Pendiente, Preparando, Listo y Entregado. Cocina avanza hasta "Listo"; entregar lo hacen caja y administrador.
- **A domicilio:** se elige la zona (céntrica Q5, rural Q15), se escribe la dirección y, si se quiere, el teléfono. El envío se suma al total. Las tarifas se pueden cambiar con las variables `ENVIO_CENTRICA` y `ENVIO_RURAL`.
- **Cobro:** efectivo, tarjeta o transferencia. En efectivo se escribe con cuánto paga el cliente y el sistema muestra el cambio (también hay botones con montos sugeridos). Un pedido queda finalizado cuando está entregado y pagado.
- **Recibo:** después de cobrar se abre el recibo para imprimirlo o guardarlo como PDF, y también se puede abrir desde cualquier pedido con el botón "Recibo". Es un comprobante de consumo, no una factura legal.
- **Cancelar:** si el pedido sigue pendiente, los ingredientes vuelven al inventario. Si ya se empezó a preparar, no vuelven. Un pedido pagado o entregado no se cancela.
- **"Hoy"** se calcula con la zona horaria `America/Guatemala` (se puede cambiar con la variable `ZONA_HORARIA`).
- Las tablas nuevas se crean solas al iniciar el servidor; los datos que ya existen no se tocan.

## Mesas y caja (Fase 3)

- **Mesas**: el tablero muestra cada mesa como *Libre* u *Ocupada* (con hora de inicio, pedidos, monto por cobrar y quién atiende). Una mesa queda libre cuando todos sus pedidos están entregados y cobrados, o cancelados. El administrador las configura en *Mesas → Configurar mesas* (hay un botón para agregar varias de una vez).
- **Caja chica**: antes de cobrar hay que abrir la caja con el fondo inicial. Durante el turno se registran ingresos y egresos de efectivo. Al cerrar se cuenta el efectivo y el sistema compara contra lo esperado (fondo + ventas en efectivo + ingresos - egresos), muestra sobrante o faltante y genera un reporte imprimible. Solo puede haber una caja abierta a la vez.
- **Quién tomó el pedido**: cada tarjeta de pedido muestra el usuario que lo creó. Crea un usuario por empleado en *Usuarios*.
- Si actualizas un sistema que ya estaba publicado: crea tus mesas (*Configurar mesas*) y abre la caja antes del primer cobro. Los pedidos cobrados antes de esta versión no pertenecen a ninguna caja.

## Estructura

```
render.yaml  Despliegue en Render
backend/     API (rutas en src/routes, esquema en sql/schema.sql)
frontend/    Interfaz (páginas en src/paginas)
```
