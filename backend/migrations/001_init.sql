-- ============================================================
-- Migration 001: Inisialisasi tabel transactions
-- ============================================================

-- Aktifkan extension pgcrypto untuk gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabel utama transaksi keuangan
CREATE TABLE IF NOT EXISTS transactions (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_number         TEXT            NOT NULL,
    type              TEXT            NOT NULL CHECK (type IN ('income', 'expense')),
    amount            NUMERIC(14, 2)  NOT NULL,
    category          TEXT            NOT NULL,
    description       TEXT,
    transaction_date  DATE            NOT NULL DEFAULT CURRENT_DATE,
    raw_message       TEXT,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Index untuk mempercepat query dashboard
CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_type     ON transactions (type);
