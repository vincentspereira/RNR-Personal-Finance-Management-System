-- 001_init.sql — base schema, idempotent for fresh + already-bootstrapped DBs.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'cash', 'investment')),
  currency VARCHAR(10) DEFAULT 'USD',
  opening_balance DECIMAL(15,2) DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  color VARCHAR(20) DEFAULT '#3b82f6',
  icon VARCHAR(100),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(20) DEFAULT '#6b7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename VARCHAR(500) NOT NULL,
  original_path VARCHAR(1000) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  document_count INT DEFAULT 0,
  raw_ai_response JSONB,
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  description TEXT,
  merchant_name VARCHAR(255),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB,
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'scanned', 'imported')),
  scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  document_index INT NOT NULL DEFAULT 0,
  document_type VARCHAR(30) CHECK (document_type IN ('invoice', 'receipt', 'bill', 'statement', 'unknown')),
  vendor_name VARCHAR(255),
  vendor_address TEXT,
  document_date DATE,
  due_date DATE,
  invoice_number VARCHAR(100),
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total_amount DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'USD',
  line_items JSONB DEFAULT '[]',
  payment_method VARCHAR(100),
  confidence_score FLOAT,
  raw_extracted_data JSONB,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multi-tenant user_id columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Savings goals
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  target_amount DECIMAL(15,2) NOT NULL,
  current_amount DECIMAL(15,2) DEFAULT 0,
  target_date DATE,
  color VARCHAR(20) DEFAULT '#3b82f6',
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  description VARCHAR(255),
  merchant_name VARCHAR(255),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  avg_amount DECIMAL(15,2),
  frequency VARCHAR(20) CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  interval_days INT,
  confidence FLOAT DEFAULT 0,
  occurrence_count INT DEFAULT 0,
  first_date DATE,
  last_date DATE,
  next_predicted_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS import_hash VARCHAR(64);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('budget_warning', 'budget_exceeded', 'goal_completed', 'recurring_due', 'info')),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_scan ON transactions(scan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_import_hash ON transactions(import_hash) WHERE import_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_documents_scan ON scan_documents(scan_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_user ON recurring_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_active ON recurring_patterns(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
