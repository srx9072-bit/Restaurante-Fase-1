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
