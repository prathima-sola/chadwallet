-- ChadWallet schema
-- Run this in: Supabase dashboard > SQL editor > New query

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tables

-- One profile per authenticated Privy user.
CREATE TABLE IF NOT EXISTS profiles (
  user_id        TEXT PRIMARY KEY,
  wallet_address TEXT UNIQUE,
  display_name   TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable trade log
CREATE TABLE IF NOT EXISTS trades (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  user_wallet    TEXT NOT NULL,
  token_mint     TEXT NOT NULL,          -- Solana mint address
  token_symbol   TEXT NOT NULL,
  token_name     TEXT NOT NULL,
  side           TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  sol_amount     NUMERIC NOT NULL,
  token_amount   NUMERIC NOT NULL,
  price_usd      NUMERIC,                -- USD price at time of trade
  tx_signature   TEXT UNIQUE NOT NULL,   -- On-chain tx signature
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes

CREATE INDEX IF NOT EXISTS trades_user_wallet_idx ON trades (user_wallet);
CREATE INDEX IF NOT EXISTS trades_user_id_idx     ON trades (user_id);
CREATE INDEX IF NOT EXISTS trades_token_mint_idx  ON trades (token_mint);
CREATE INDEX IF NOT EXISTS trades_created_at_idx  ON trades (created_at DESC);

-- Row Level Security
-- We use Privy for auth, not Supabase Auth, so we don't have auth.uid().
-- Writes go through API routes that use the service role key (bypasses RLS).
-- RLS here controls anon/public reads.

ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades    ENABLE ROW LEVEL SECURITY;

-- Profiles and trades are private application data. Reads and writes go through
-- authenticated API routes that use the service role key after verifying Privy
-- access tokens. Do not add public SELECT policies for these tables.
