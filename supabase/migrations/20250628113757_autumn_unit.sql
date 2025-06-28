/*
  # Add Transaction Approval System

  1. Schema Changes
    - Add status column to personal_transactions (pending, approved, rejected)
    - Add approved_by and approved_at columns
    - Add rejection_reason column
    - Update triggers to only affect balances for approved transactions

  2. Security
    - Update RLS policies to handle pending transactions
    - Ensure only involved partners can approve/reject
    - Maintain data integrity during approval process

  3. Features
    - Transaction approval workflow
    - Rejection with reason
    - Balance updates only for approved transactions
*/

-- Add approval columns to personal_transactions
ALTER TABLE personal_transactions 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES partners(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_personal_transactions_status ON personal_transactions(status);
CREATE INDEX IF NOT EXISTS idx_personal_transactions_approved_by ON personal_transactions(approved_by);

-- Update existing transactions to be approved (for backward compatibility)
UPDATE personal_transactions 
SET status = 'approved', approved_by = to_partner_id, approved_at = created_at 
WHERE status = 'pending';

-- Drop existing trigger
DROP TRIGGER IF EXISTS personal_transaction_balance_update ON personal_transactions;

-- Update the balance function to only process approved transactions
CREATE OR REPLACE FUNCTION update_personal_balances()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT (only for approved transactions)
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
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

  -- Handle DELETE (only for approved transactions)
  IF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
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

  -- Handle UPDATE (status changes and amount changes)
  IF TG_OP = 'UPDATE' THEN
    -- If status changed from approved to something else, reverse the balance
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
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
    END IF;

    -- If status changed to approved, apply the balance
    IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
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
    END IF;

    -- If both old and new are approved but amount changed
    IF OLD.status = 'approved' AND NEW.status = 'approved' AND OLD.amount != NEW.amount THEN
      -- Reverse old amount and apply new amount
      UPDATE personal_balances
      SET 
        balance_amount = balance_amount - 
          CASE 
            WHEN OLD.from_partner_id < OLD.to_partner_id THEN -OLD.amount
            ELSE OLD.amount
          END + 
          CASE 
            WHEN NEW.from_partner_id < NEW.to_partner_id THEN -NEW.amount
            ELSE NEW.amount
          END,
        last_updated = now()
      WHERE 
        partner_a_id = LEAST(OLD.from_partner_id, OLD.to_partner_id) AND
        partner_b_id = GREATEST(OLD.from_partner_id, OLD.to_partner_id);
    END IF;
    
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for personal balance updates
CREATE TRIGGER personal_transaction_balance_update
  AFTER INSERT OR UPDATE OR DELETE ON personal_transactions
  FOR EACH ROW EXECUTE FUNCTION update_personal_balances();

-- Update RLS policies to handle approval workflow
DROP POLICY IF EXISTS "Partners can update their personal transactions" ON personal_transactions;

CREATE POLICY "Partners can update their personal transactions"
  ON personal_transactions
  FOR UPDATE
  TO authenticated
  USING (
    -- Creator can edit if pending
    (auth.uid() = from_partner_id AND status = 'pending') OR
    -- Receiver can approve/reject if pending
    (auth.uid() = to_partner_id AND status = 'pending') OR
    -- Either party can edit if approved (for corrections)
    (status = 'approved' AND (auth.uid() = from_partner_id OR auth.uid() = to_partner_id))
  );