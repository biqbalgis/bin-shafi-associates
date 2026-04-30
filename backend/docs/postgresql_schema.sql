CREATE TABLE clients_client (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    contact_email VARCHAR(254) NOT NULL DEFAULT '',
    contact_phone VARCHAR(50) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users_user (
    id BIGSERIAL PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMPTZ NULL,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    username VARCHAR(150) NOT NULL UNIQUE,
    first_name VARCHAR(150) NOT NULL DEFAULT '',
    last_name VARCHAR(150) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    role VARCHAR(20) NOT NULL,
    client_id BIGINT NULL REFERENCES clients_client(id) ON DELETE SET NULL
);

CREATE TABLE aircrafts_aircraft (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients_client(id) ON DELETE CASCADE,
    registration_no VARCHAR(100) NOT NULL UNIQUE,
    aircraft_model VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100) NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders_airport (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT '',
    country VARCHAR(100) NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE orders_fueltype (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE orders_fuelcategory (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE orders_order (
    id BIGSERIAL PRIMARY KEY,
    ser_no VARCHAR(30) NOT NULL UNIQUE,
    date DATE NOT NULL,
    flight VARCHAR(100) NOT NULL,
    flight_status VARCHAR(20) NOT NULL DEFAULT 'DOMESTIC',
    client_id BIGINT NOT NULL REFERENCES clients_client(id) ON DELETE RESTRICT,
    aircraft_id BIGINT NOT NULL REFERENCES aircrafts_aircraft(id) ON DELETE RESTRICT,
    airport_id BIGINT NOT NULL REFERENCES orders_airport(id) ON DELETE RESTRICT,
    route VARCHAR(255) NOT NULL,
    dr_no VARCHAR(100) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL,
    fuel_type_id BIGINT NOT NULL REFERENCES orders_fueltype(id) ON DELETE RESTRICT,
    quantity_ltrs NUMERIC(12, 2) NOT NULL,
    created_by_id BIGINT NOT NULL REFERENCES users_user(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders_orderstatusauditlog (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders_order(id) ON DELETE CASCADE,
    old_status VARCHAR(20) NOT NULL DEFAULT '',
    new_status VARCHAR(20) NOT NULL,
    changed_by_id BIGINT NULL REFERENCES users_user(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE financials_financial (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders_order(id) ON DELETE CASCADE,
    dr_no VARCHAR(100) NOT NULL DEFAULT '',
    digital_invoice VARCHAR(100) NOT NULL DEFAULT '',
    pso_invoice VARCHAR(100) NOT NULL DEFAULT '',
    pso_rate NUMERIC(12, 2) NULL,
    pso_price NUMERIC(14, 2) NULL,
    fueling_charges NUMERIC(14, 2) NULL,
    pso_gst NUMERIC(14, 2) NULL,
    pso_total_price NUMERIC(14, 2) NULL,
    bsa_invoice VARCHAR(100) NOT NULL DEFAULT '',
    bsa_rate NUMERIC(12, 2) NULL,
    bsa_price NUMERIC(14, 2) NULL,
    bsa_fueling_charges NUMERIC(14, 2) NULL,
    bsa_gst NUMERIC(14, 2) NULL,
    bsa_total_price NUMERIC(14, 2) NULL,
    profit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
