-- Migration for existing ChadWallet Supabase projects.
-- Converts wallet-keyed profiles to Privy user-keyed profiles and removes public reads.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP POLICY IF EXISTS "Public read profiles" ON profiles;
DROP POLICY IF EXISTS "Public read trades" ON trades;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE profiles
SET
  user_id = COALESCE(
    user_id,
    CASE
      WHEN wallet_address IS NOT NULL AND wallet_address <> '' THEN 'legacy:' || wallet_address
      ELSE 'legacy:' || gen_random_uuid()::text
    END
  ),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE user_id IS NULL OR updated_at IS NULL;

ALTER TABLE profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE profiles ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_user_id_key'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_wallet_address_key'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_wallet_address_key UNIQUE (wallet_address);
  END IF;
END $$;

ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id TEXT;

UPDATE trades
SET user_id = COALESCE(user_id, 'legacy:' || user_wallet)
WHERE user_id IS NULL;

INSERT INTO profiles (user_id, wallet_address, updated_at)
SELECT DISTINCT
  'legacy:' || trades.user_wallet,
  trades.user_wallet,
  NOW()
FROM trades
WHERE trades.user_wallet IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = 'legacy:' || trades.user_wallet
  );

ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE trades ALTER COLUMN sol_amount TYPE NUMERIC USING sol_amount::numeric;
ALTER TABLE trades ALTER COLUMN token_amount TYPE NUMERIC USING token_amount::numeric;
ALTER TABLE trades ALTER COLUMN price_usd TYPE NUMERIC USING price_usd::numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trades_user_id_fkey'
      AND conrelid = 'trades'::regclass
  ) THEN
    ALTER TABLE trades
      ADD CONSTRAINT trades_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trades_user_wallet_idx ON trades (user_wallet);
CREATE INDEX IF NOT EXISTS trades_user_id_idx     ON trades (user_id);
CREATE INDEX IF NOT EXISTS trades_token_mint_idx  ON trades (token_mint);
CREATE INDEX IF NOT EXISTS trades_created_at_idx  ON trades (created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
