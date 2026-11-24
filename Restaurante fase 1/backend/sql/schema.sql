-- Esquema PostgreSQL. Es seguro correrlo varias veces (no borra nada).

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(10) NOT NULL DEFAULT 'cajero' CHECK (rol IN ('admin', 'cajero', 'cocina')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proveedores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  contacto VARCHAR(120),
  telefono VARCHAR(30),
  email VARCHAR(120),
  direccion VARCHAR(200),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(30),
  email VARCHAR(120),
  notas VARCHAR(255),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insumos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  unidad VARCHAR(20) NOT NULL,
  stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
  proveedor_id INT REFERENCES proveedores(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Cada cambio de stock queda registrado (entradas, salidas y conteos)
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id SERIAL PRIMARY KEY,
  insumo_id INT NOT NULL REFERENCES insumos(id),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad NUMERIC(10,2) NOT NULL,
  stock_resultante NUMERIC(10,2) NOT NULL,
  nota VARCHAR(255),
  usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(255),
  categoria VARCHAR(50) NOT NULL DEFAULT 'General',
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Receta: cuánto de cada insumo lleva una porción del plato
CREATE TABLE IF NOT EXISTS plato_ingredientes (
  plato_id INT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
  insumo_id INT NOT NULL REFERENCES insumos(id),
  cantidad NUMERIC(10,3) NOT NULL,
  PRIMARY KEY (plato_id, insumo_id)
);

-- ===== Fase 2: pedidos =====
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(10) NOT NULL DEFAULT 'mesa' CHECK (tipo IN ('mesa', 'llevar', 'domicilio')),
  referencia VARCHAR(60),                      -- número de mesa o nombre de quien recoge
  cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'preparando', 'listo', 'entregado', 'cancelado')),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  pagado BOOLEAN NOT NULL DEFAULT FALSE,
  metodo_pago VARCHAR(15) CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
  pagado_en TIMESTAMPTZ,
  usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pedidos_creado_idx ON pedidos (creado_en);

-- Cada línea guarda el nombre y el precio del momento, así un cambio de precio no altera pedidos viejos
CREATE TABLE IF NOT EXISTS pedido_items (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  plato_id INT REFERENCES platos(id) ON DELETE SET NULL,
  nombre VARCHAR(120) NOT NULL,
  precio NUMERIC(10,2) NOT NULL,
  cantidad INT NOT NULL CHECK (cantidad > 0),
  nota VARCHAR(255)
);

-- ===== Domicilio, pago en efectivo y recibo (estas líneas actualizan tablas que ya existían) =====
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_tipo_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_tipo_check CHECK (tipo IN ('mesa', 'llevar', 'domicilio'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS zona_envio VARCHAR(10) CHECK (zona_envio IN ('centrica', 'rural'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(10,2) NOT NULL DEFAULT 0;  -- ya incluido en total
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefono VARCHAR(30);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS recibido NUMERIC(10,2);   -- dinero que entregó el cliente (efectivo)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cambio NUMERIC(10,2);

-- ===== Mesas y caja =====
CREATE TABLE IF NOT EXISTS mesas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  capacidad INT NOT NULL DEFAULT 4 CHECK (capacidad > 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Una caja es un turno: se abre con un fondo inicial (caja chica) y se cierra contando el efectivo
CREATE TABLE IF NOT EXISTS cajas (
  id SERIAL PRIMARY KEY,
  estado VARCHAR(10) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  monto_inicial NUMERIC(10,2) NOT NULL DEFAULT 0,
  abierta_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  abierta_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
  cerrada_en TIMESTAMPTZ,
  cerrada_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
  esperado NUMERIC(10,2),     -- efectivo que debía haber al cerrar
  contado NUMERIC(10,2),      -- efectivo que se contó
  diferencia NUMERIC(10,2),   -- contado - esperado (negativo = faltante)
  notas VARCHAR(255)
);
CREATE UNIQUE INDEX IF NOT EXISTS una_sola_caja_abierta ON cajas (estado) WHERE estado = 'abierta';

-- Ingresos y egresos de efectivo durante el turno (compras pequeñas, retiros, etc.)
CREATE TABLE IF NOT EXISTS caja_movimientos (
  id SERIAL PRIMARY KEY,
  caja_id INT NOT NULL REFERENCES cajas(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  concepto VARCHAR(120) NOT NULL,
  usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS mesa_id INT REFERENCES mesas(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS caja_id INT REFERENCES cajas(id) ON DELETE SET NULL;  -- caja en la que se cobró

-- ===== PIN para cambiar de usuario rápido y costos de los ingredientes =====
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);           -- PIN de 4 dígitos (cifrado)
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS costo NUMERIC(12,4) NOT NULL DEFAULT 0;  -- lo que cuesta 1 unidad de medida (Q por lb, por litro...)
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS costo NUMERIC(12,4);         -- costo de ingredientes de 1 porción el día del pedido
