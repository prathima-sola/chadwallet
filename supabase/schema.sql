-- ChadWallet schema
-- Run this in: Supabase dashboard → SQL editor → New query

-- ─── Tables ───────────────────────────────────────────────────────────────────

-- One profile per connected wallet
CREATE TABLE IF NOT EXISTS profiles (
  wallet_address TEXT PRIMARY KEY,
  display_name   TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable trade log
CREATE TABLE IF NOT EXISTS trades (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet    TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
  token_mint     TEXT NOT NULL,          -- Solana mint address
  token_symbol   TEXT NOT NULL,
  token_name     TEXT NOT NULL,
  side           TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  sol_amount     NUMERIC(20, 9) NOT NULL,
  token_amount   NUMERIC(30, 9) NOT NULL,
  price_usd      NUMERIC(20, 10),        -- USD price at time of trade
  tx_signature   TEXT UNIQUE NOT NULL,   -- On-chain tx signature
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user token watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet    TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
  token_mint     TEXT NOT NULL,
  token_symbol   TEXT,
  token_name     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_wallet, token_mint)       -- No duplicate entries per user
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS trades_user_wallet_idx ON trades (user_wallet);
CREATE INDEX IF NOT EXISTS trades_token_mint_idx  ON trades (token_mint);
CREATE INDEX IF NOT EXISTS trades_created_at_idx  ON trades (created_at DESC);
CREATE INDEX IF NOT EXISTS watchlist_user_idx     ON watchlist (user_wallet);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- We use Privy for auth, not Supabase Auth, so we don't have auth.uid().
-- Writes go through API routes that use the service role key (bypasses RLS).
-- RLS here controls anon/public reads.

ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades    ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Profiles: public read (for leaderboard, social feed)
CREATE POLICY "Public read profiles"
  ON profiles FOR SELECT USING (true);

-- Trades: public read (leaderboard + social feed), service role handles writes
CREATE POLICY "Public read trades"
  ON trades FOR SELECT USING (true);

-- Watchlist: private — no public reads
-- Reads happen via API routes with service role key, so no SELECT policy needed here.
-- If you add Supabase Auth later, add a policy: USING (auth.uid()::text = user_wallet)
