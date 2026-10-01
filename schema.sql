-- ==============================================================
-- Skema Database Cloudflare D1 untuk ZayMail (Temporary Email)
-- ==============================================================

-- 1. Tabel Alamat Email Sementara (Addresses)
CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    address TEXT UNIQUE NOT NULL COLLATE NOCASE,
    token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- 2. Tabel Pesan Masuk (Messages)
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL COLLATE NOCASE,
    from_name TEXT,
    from_email TEXT NOT NULL,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    raw_size INTEGER DEFAULT 0,
    received_at INTEGER NOT NULL,
    is_read INTEGER DEFAULT 0,
    FOREIGN KEY(address) REFERENCES addresses(address) ON DELETE CASCADE
);

-- 3. Indexes untuk Optimasi Performa Query
CREATE INDEX IF NOT EXISTS idx_addresses_address ON addresses(address);
CREATE INDEX IF NOT EXISTS idx_addresses_expires ON addresses(expires_at);
CREATE INDEX IF NOT EXISTS idx_messages_address ON messages(address);
CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(received_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(address, is_read);
