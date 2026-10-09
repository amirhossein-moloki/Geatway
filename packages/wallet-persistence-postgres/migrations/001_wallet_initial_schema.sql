-- Wallet & Double-Entry Ledger Schema

CREATE TABLE IF NOT EXISTS wallets (
  id VARCHAR(64) PRIMARY KEY,
  owner_id VARCHAR(64) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallets_owner_id ON wallets(owner_id);
CREATE INDEX IF NOT EXISTS idx_wallets_status ON wallets(status);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  currency VARCHAR(10) NOT NULL,
  wallet_id VARCHAR(64) NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
  balance BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_wallet_id ON ledger_accounts(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_type ON ledger_accounts(type);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_wallet_type ON ledger_accounts(wallet_id, type);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id VARCHAR(64) PRIMARY KEY,
  description TEXT NOT NULL,
  idempotency_key VARCHAR(255) NULL,
  reference VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'REJECTED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  posted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ledger_transactions_idempotency_key
  ON ledger_transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_transactions_status ON ledger_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_reference ON ledger_transactions(reference);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id VARCHAR(64) PRIMARY KEY,
  transaction_id VARCHAR(64) NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  account_id VARCHAR(64) NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL,
  memo TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id ON ledger_entries(account_id);
