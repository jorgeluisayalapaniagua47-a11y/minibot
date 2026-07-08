-- Esquema adaptado para PostgreSQL (Supabase)
-- 1. Tabla: generos
CREATE TABLE IF NOT EXISTS generos (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL
);
-- 2. Tabla: peliculas
CREATE TABLE IF NOT EXISTS peliculas (
    id SERIAL PRIMARY KEY,
    genero_id INTEGER NOT NULL REFERENCES generos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    sinopsis TEXT,
    imagen_url TEXT,
    activa BOOLEAN DEFAULT true
);
-- 3. Tabla: funciones
CREATE TABLE IF NOT EXISTS funciones (
    id SERIAL PRIMARY KEY,
    pelicula_id INTEGER NOT NULL REFERENCES peliculas(id) ON DELETE CASCADE,
    fecha_hora TIMESTAMP NOT NULL,
    sala TEXT NOT NULL,
    capacidad_total INTEGER NOT NULL,
    capacidad_disponible INTEGER NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL
);
-- 4. Tabla: contactos
CREATE TABLE IF NOT EXISTS contactos (
    id SERIAL PRIMARY KEY,
    wa_id TEXT UNIQUE NOT NULL,
    nombre_perfil TEXT,
    estado_conversacion TEXT DEFAULT 'WELCOME',
    contexto_json JSONB DEFAULT '{}'::jsonb,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 5. Tabla: reservas
CREATE TABLE IF NOT EXISTS reservas (
    id SERIAL PRIMARY KEY,
    contacto_id INTEGER NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
    funcion_id INTEGER NOT NULL REFERENCES funciones(id) ON DELETE CASCADE,
    cantidad_entradas INTEGER NOT NULL,
    monto_total DECIMAL(10, 2) NOT NULL,
    estado TEXT CHECK(
        estado IN ('PENDIENTE', 'CONFIRMADA', 'CANCELADA')
    ) DEFAULT 'PENDIENTE',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 6. Tabla: pagos
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    reserva_id INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    evento_id TEXT UNIQUE NOT NULL,
    metodo_pago TEXT NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    estado TEXT CHECK(estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')) DEFAULT 'PENDIENTE',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 7. Tabla: mensajes
CREATE TABLE IF NOT EXISTS mensajes (
    id SERIAL PRIMARY KEY,
    contacto_id INTEGER NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
    direccion TEXT CHECK(direccion IN ('in', 'out')) NOT NULL,
    wa_message_id TEXT UNIQUE NOT NULL,
    tipo_mensaje TEXT CHECK(
        tipo_mensaje IN (
            'text',
            'image',
            'interactive_list',
            'interactive_button'
        )
    ) NOT NULL,
    contenido TEXT NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- ==========================================
-- Insertar Datos Iniciales (Cartelera)
-- ==========================================
INSERT INTO generos (nombre)
VALUES ('Acción'),
    ('Ciencia Ficción'),
    ('Drama/Suspenso') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO peliculas (genero_id, titulo, sinopsis, imagen_url)
VALUES (
        1,
        'Mad Max: Fury Road',
        'En un futuro post-apocalíptico, una mujer se rebela...',
        '/img/madmax.jpg'
    ),
    (
        1,
        'John Wick: Chapter 4',
        'John Wick descubre un camino para derrotar a la Alta Mesa...',
        '/img/johnwick.jpg'
    ),
    (
        2,
        'Interstellar',
        'Un grupo de exploradores hace uso de un agujero de gusano...',
        '/img/interstellar.jpg'
    ),
    (
        2,
        'The Matrix',
        'Un programador de computadoras descubre que el mundo es una simulación...',
        '/img/matrix.jpg'
    ),
    (
        3,
        'Shutter Island',
        'En 1954, el alguacil Teddy Daniels investiga...',
        '/img/shutterisland.jpg'
    ),
    (
        3,
        'Fight Club',
        'Un oficinista insomne y un fabricante de jabón...',
        '/img/fightclub.jpg'
    );
INSERT INTO funciones (
        pelicula_id,
        fecha_hora,
        sala,
        capacidad_total,
        capacidad_disponible,
        precio_unitario
    )
SELECT id,
    '2026-07-10 17:00:00'::TIMESTAMP,
    'Sala 1',
    50,
    50,
    50.00
FROM peliculas
UNION ALL
SELECT id,
    '2026-07-10 20:00:00'::TIMESTAMP,
    'Sala 2',
    50,
    50,
    50.00
FROM peliculas
UNION ALL
SELECT id,
    '2026-07-10 22:30:00'::TIMESTAMP,
    'Sala 3',
    50,
    50,
    50.00
FROM peliculas;