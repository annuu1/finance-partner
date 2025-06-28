/*
  # Initial Schema for Business Partner Finance Management

  1. New Tables
    - `partners`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique)
      - `full_name` (text)
      - `current_balance` (numeric, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `daily_sales`
      - `id` (uuid, primary key)
      - `date` (date, unique)
      - `total_amount` (numeric)
      - `online_amount` (numeric)
      - `cash_amount` (numeric)
      - `notes` (text, nullable)
      - `created_by` (uuid, references partners.id)
      - `created_at` (timestamp)
    
    - `partner_transactions`
      - `id` (uuid, primary key)
      - `from_partner_id` (uuid, references partners.id)
      - `to_partner_id` (uuid, references partners.id)
      - `amount` (numeric)
      - `description` (text, nullable)
      - `transaction_date` (date)
      - `created_at` (timestamp)
    
    - `expense_categories`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text, nullable)
      - `created_at` (timestamp)
    
    - `expenses`
      - `id` (uuid, primary key)
      - `category_id` (uuid, references expense_categories.id)
      - `amount` (numeric)
      - `description` (text)
      - `expense_date` (date)
      - `receipt_url` (text, nullable)
      - `created_by` (uuid, references partners.id)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for reading partner data
*/

-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  current_balance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create daily_sales table
CREATE TABLE IF NOT EXISTS daily_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date UNIQUE NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  online_amount numeric NOT NULL DEFAULT 0,
  cash_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create partner_transactions table
CREATE TABLE IF NOT EXISTS partner_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  to_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  description text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT different_partners CHECK (from_partner_id != to_partner_id)
);

-- Create expense_categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount numeric NOT NULL,
  description text NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  created_by uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for partners table
CREATE POLICY "Partners can read all partner data"
  ON partners
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Partners can update their own data"
  ON partners
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create policies for daily_sales table
CREATE POLICY "Partners can read all sales data"
  ON daily_sales
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Partners can insert sales data"
  ON daily_sales
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Partners can update sales data they created"
  ON daily_sales
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Partners can delete sales data they created"
  ON daily_sales
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create policies for partner_transactions table
CREATE POLICY "Partners can read all transaction data"
  ON partner_transactions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Partners can insert transactions involving themselves"
  ON partner_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_partner_id OR auth.uid() = to_partner_id);

CREATE POLICY "Partners can update transactions involving themselves"
  ON partner_transactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_partner_id OR auth.uid() = to_partner_id);

CREATE POLICY "Partners can delete transactions involving themselves"
  ON partner_transactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = from_partner_id OR auth.uid() = to_partner_id);

-- Create policies for expense_categories table
CREATE POLICY "Partners can read all expense categories"
  ON expense_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Partners can manage expense categories"
  ON expense_categories
  FOR ALL
  TO authenticated
  USING (true);

-- Create policies for expenses table
CREATE POLICY "Partners can read all expense data"
  ON expenses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Partners can insert expenses"
  ON expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Partners can update expenses they created"
  ON expenses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Partners can delete expenses they created"
  ON expenses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Insert default expense categories
INSERT INTO expense_categories (name, description) VALUES
  ('Utilities', 'Electricity, water, internet, phone bills'),
  ('Rent', 'Office or workspace rental costs'),
  ('Supplies', 'Office supplies, equipment, materials'),
  ('Marketing', 'Advertising and promotional expenses'),
  ('Transportation', 'Travel and vehicle expenses'),
  ('Professional Services', 'Legal, accounting, consulting fees'),
  ('Insurance', 'Business insurance premiums'),
  ('Maintenance', 'Equipment and facility maintenance'),
  ('Other', 'Miscellaneous business expenses')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales(date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_created_by ON daily_sales(created_by);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_from_partner ON partner_transactions(from_partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_to_partner ON partner_transactions(to_partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_date ON partner_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- Create function to update partner balances on transaction
CREATE OR REPLACE FUNCTION update_partner_balances()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Subtract from sender, add to receiver
    UPDATE partners SET 
      current_balance = current_balance - NEW.amount,
      updated_at = now()
    WHERE id = NEW.from_partner_id;
    
    UPDATE partners SET 
      current_balance = current_balance + NEW.amount,
      updated_at = now()
    WHERE id = NEW.to_partner_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse old transaction
    UPDATE partners SET 
      current_balance = current_balance + OLD.amount,
      updated_at = now()
    WHERE id = OLD.from_partner_id;
    
    UPDATE partners SET 
      current_balance = current_balance - OLD.amount,
      updated_at = now()
    WHERE id = OLD.to_partner_id;
    
    -- Apply new transaction
    UPDATE partners SET 
      current_balance = current_balance - NEW.amount,
      updated_at = now()
    WHERE id = NEW.from_partner_id;
    
    UPDATE partners SET 
      current_balance = current_balance + NEW.amount,
      updated_at = now()
    WHERE id = NEW.to_partner_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Reverse transaction
    UPDATE partners SET 
      current_balance = current_balance + OLD.amount,
      updated_at = now()
    WHERE id = OLD.from_partner_id;
    
    UPDATE partners SET 
      current_balance = current_balance - OLD.amount,
      updated_at = now()
    WHERE id = OLD.to_partner_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for partner balance updates
DROP TRIGGER IF EXISTS partner_transaction_balance_update ON partner_transactions;
CREATE TRIGGER partner_transaction_balance_update
  AFTER INSERT OR UPDATE OR DELETE ON partner_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_balances();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for partners updated_at
DROP TRIGGER IF EXISTS partners_updated_at ON partners;
CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();