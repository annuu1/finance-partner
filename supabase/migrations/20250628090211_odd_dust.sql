/*
  # Personal Space Feature Schema

  1. New Tables
    - `personal_transactions` - Track personal financial transactions between partners
    - `automated_transaction_rules` - Store recurring transaction rules
    - `partner_messages` - Private chat system between partners
    - `message_attachments` - File attachments for messages
    - `partner_notes` - Personal note-taking functionality

  2. Security
    - Enable RLS on all new tables
    - Add policies for partner-specific access control
    - Ensure privacy between different partner pairs

  3. Features
    - Personal transaction management
    - Automated recurring transactions
    - Private messaging system
    - File attachment support
    - Note-taking functionality
*/

-- Personal Transactions Table
CREATE TABLE IF NOT EXISTS personal_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  to_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('borrow', 'lend', 'payment', 'transfer')),
  description text,
  category text DEFAULT 'general',
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean DEFAULT false,
  recurring_rule_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT different_partners_personal CHECK (from_partner_id <> to_partner_id)
);

-- Automated Transaction Rules Table
CREATE TABLE IF NOT EXISTS automated_transaction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  to_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('borrow', 'lend', 'payment', 'transfer')),
  description text NOT NULL,
  category text DEFAULT 'general',
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  start_date date NOT NULL,
  end_date date,
  next_execution_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT different_partners_rules CHECK (from_partner_id <> to_partner_id)
);

-- Partner Messages Table
CREATE TABLE IF NOT EXISTS partner_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT different_partners_messages CHECK (sender_id <> receiver_id)
);

-- Message Attachments Table
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES partner_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  uploaded_at timestamptz DEFAULT now()
);

-- Partner Notes Table
CREATE TABLE IF NOT EXISTS partner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'general',
  is_private boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Personal Balance Tracking Table
CREATE TABLE IF NOT EXISTS personal_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_a_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  partner_b_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  balance_amount numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  CONSTRAINT different_partners_balance CHECK (partner_a_id <> partner_b_id),
  CONSTRAINT unique_partner_pair UNIQUE (partner_a_id, partner_b_id)
);

-- Enable RLS on all tables
ALTER TABLE personal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_transaction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Personal Transactions
CREATE POLICY "Partners can view their personal transactions"
  ON personal_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = from_partner_id OR auth.uid() = to_partner_id);

CREATE POLICY "Partners can insert their personal transactions"
  ON personal_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_partner_id OR auth.uid() = to_partner_id);

CREATE POLICY "Partners can update their personal transactions"
  ON personal_transactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_partner_id OR auth.uid() = to_partner_id);

CREATE POLICY "Partners can delete their personal transactions"
  ON personal_transactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = from_partner_id OR auth.uid() = to_partner_id);

-- RLS Policies for Automated Rules
CREATE POLICY "Partners can view their automation rules"
  ON automated_transaction_rules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = from_partner_id OR auth.uid() = to_partner_id);

CREATE POLICY "Partners can insert automation rules"
  ON automated_transaction_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Partners can update their automation rules"
  ON automated_transaction_rules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Partners can delete their automation rules"
  ON automated_transaction_rules
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for Messages
CREATE POLICY "Partners can view their messages"
  ON partner_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Partners can send messages"
  ON partner_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Partners can update their messages"
  ON partner_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- RLS Policies for Message Attachments
CREATE POLICY "Partners can view message attachments"
  ON message_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partner_messages 
      WHERE id = message_id 
      AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    )
  );

CREATE POLICY "Partners can insert message attachments"
  ON message_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partner_messages 
      WHERE id = message_id 
      AND sender_id = auth.uid()
    )
  );

-- RLS Policies for Notes
CREATE POLICY "Partners can manage their own notes"
  ON partner_notes
  FOR ALL
  TO authenticated
  USING (auth.uid() = partner_id);

-- RLS Policies for Personal Balances
CREATE POLICY "Partners can view their personal balances"
  ON personal_balances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = partner_a_id OR auth.uid() = partner_b_id);

CREATE POLICY "Partners can manage their personal balances"
  ON personal_balances
  FOR ALL
  TO authenticated
  USING (auth.uid() = partner_a_id OR auth.uid() = partner_b_id);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_personal_transactions_from_partner ON personal_transactions(from_partner_id);
CREATE INDEX IF NOT EXISTS idx_personal_transactions_to_partner ON personal_transactions(to_partner_id);
CREATE INDEX IF NOT EXISTS idx_personal_transactions_date ON personal_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_automated_rules_next_execution ON automated_transaction_rules(next_execution_date);
CREATE INDEX IF NOT EXISTS idx_partner_messages_sender ON partner_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_partner_messages_receiver ON partner_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_partner_messages_created_at ON partner_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_partner_notes_partner ON partner_notes(partner_id);
CREATE INDEX IF NOT EXISTS idx_personal_balances_partners ON personal_balances(partner_a_id, partner_b_id);

-- Function to update personal balances
CREATE OR REPLACE FUNCTION update_personal_balances()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    -- Update balance for the partner pair
    INSERT INTO personal_balances (partner_a_id, partner_b_id, balance_amount, last_updated)
    VALUES (
      LEAST(NEW.from_partner_id, NEW.to_partner_id),
      GREATEST(NEW.from_partner_id, NEW.to_partner_id),
      CASE 
        WHEN NEW.from_partner_id < NEW.to_partner_id THEN -NEW.amount
        ELSE NEW.amount
      END,
      now()
    )
    ON CONFLICT (partner_a_id, partner_b_id)
    DO UPDATE SET
      balance_amount = personal_balances.balance_amount + 
        CASE 
          WHEN NEW.from_partner_id < NEW.to_partner_id THEN -NEW.amount
          ELSE NEW.amount
        END,
      last_updated = now();
    
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    -- Reverse the balance update
    UPDATE personal_balances
    SET 
      balance_amount = balance_amount - 
        CASE 
          WHEN OLD.from_partner_id < OLD.to_partner_id THEN -OLD.amount
          ELSE OLD.amount
        END,
      last_updated = now()
    WHERE 
      partner_a_id = LEAST(OLD.from_partner_id, OLD.to_partner_id) AND
      partner_b_id = GREATEST(OLD.from_partner_id, OLD.to_partner_id);
    
    RETURN OLD;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Reverse old transaction
    UPDATE personal_balances
    SET 
      balance_amount = balance_amount - 
        CASE 
          WHEN OLD.from_partner_id < OLD.to_partner_id THEN -OLD.amount
          ELSE OLD.amount
        END,
      last_updated = now()
    WHERE 
      partner_a_id = LEAST(OLD.from_partner_id, OLD.to_partner_id) AND
      partner_b_id = GREATEST(OLD.from_partner_id, OLD.to_partner_id);

    -- Apply new transaction
    INSERT INTO personal_balances (partner_a_id, partner_b_id, balance_amount, last_updated)
    VALUES (
      LEAST(NEW.from_partner_id, NEW.to_partner_id),
      GREATEST(NEW.from_partner_id, NEW.to_partner_id),
      CASE 
        WHEN NEW.from_partner_id < NEW.to_partner_id THEN -NEW.amount
        ELSE NEW.amount
      END,
      now()
    )
    ON CONFLICT (partner_a_id, partner_b_id)
    DO UPDATE SET
      balance_amount = personal_balances.balance_amount + 
        CASE 
          WHEN NEW.from_partner_id < NEW.to_partner_id THEN -NEW.amount
          ELSE NEW.amount
        END,
      last_updated = now();
    
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for personal balance updates
CREATE TRIGGER personal_transaction_balance_update
  AFTER INSERT OR UPDATE OR DELETE ON personal_transactions
  FOR EACH ROW EXECUTE FUNCTION update_personal_balances();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at columns
CREATE TRIGGER personal_transactions_updated_at
  BEFORE UPDATE ON personal_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER automated_rules_updated_at
  BEFORE UPDATE ON automated_transaction_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER partner_notes_updated_at
  BEFORE UPDATE ON partner_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();