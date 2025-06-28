/*
  # Add Approval System for Business Transactions

  1. Schema Changes
    - Add approval columns to partner_transactions table
    - Add status tracking (pending, approved, rejected)
    - Add approval metadata (approved_by, approved_at, rejection_reason)

  2. Functions
    - Update balance function to only process approved transactions
    - Add approval handling function
    - Separate business and personal transaction balance updates

  3. Security
    - Update RLS policies for approval workflow
    - Add validation constraints
    - Create performance indexes

  4. Data Migration
    - Set existing transactions as approved for backward compatibility
    - Recalculate balances based on approved transactions only
*/

-- Add approval columns to partner_transactions (business transactions)
ALTER TABLE partner_transactions 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES partners(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_partner_transactions_status ON partner_transactions(status);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_approved_by ON partner_transactions(approved_by);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_pending_business 
ON partner_transactions(to_partner_id, status) 
WHERE status = 'pending';

-- Update existing business transactions to be approved (for backward compatibility)
UPDATE partner_transactions 
SET status = 'approved', approved_by = to_partner_id, approved_at = created_at 
WHERE status IS NULL OR status = 'pending';

-- Drop existing business transaction balance trigger
DROP TRIGGER IF EXISTS partner_transaction_balance_update ON partner_transactions;

-- Create separate function for business transaction balance updates
CREATE OR REPLACE FUNCTION update_business_partner_balances()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT (only for approved transactions)
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
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
  END IF;

  -- Handle DELETE (only for approved transactions)
  IF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
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

  -- Handle UPDATE (status changes and amount changes)
  IF TG_OP = 'UPDATE' THEN
    -- If status changed from approved to something else, reverse the balance
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      UPDATE partners SET 
        current_balance = current_balance + OLD.amount,
        updated_at = now()
      WHERE id = OLD.from_partner_id;
      
      UPDATE partners SET 
        current_balance = current_balance - OLD.amount,
        updated_at = now()
      WHERE id = OLD.to_partner_id;
    END IF;

    -- If status changed to approved, apply the balance
    IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      UPDATE partners SET 
        current_balance = current_balance - NEW.amount,
        updated_at = now()
      WHERE id = NEW.from_partner_id;
      
      UPDATE partners SET 
        current_balance = current_balance + NEW.amount,
        updated_at = now()
      WHERE id = NEW.to_partner_id;
    END IF;

    -- If both old and new are approved but amount changed
    IF OLD.status = 'approved' AND NEW.status = 'approved' AND OLD.amount != NEW.amount THEN
      -- Reverse old amount and apply new amount
      UPDATE partners SET 
        current_balance = current_balance + OLD.amount - NEW.amount,
        updated_at = now()
      WHERE id = NEW.from_partner_id;
      
      UPDATE partners SET 
        current_balance = current_balance - OLD.amount + NEW.amount,
        updated_at = now()
      WHERE id = NEW.to_partner_id;
    END IF;
    
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for business transaction balance updates
CREATE TRIGGER partner_transaction_balance_update
  AFTER INSERT OR UPDATE OR DELETE ON partner_transactions
  FOR EACH ROW EXECUTE FUNCTION update_business_partner_balances();

-- Create function to handle business transaction approval
CREATE OR REPLACE FUNCTION handle_business_transaction_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Set approval timestamp when status changes to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    NEW.approved_at = now();
  END IF;
  
  -- Clear approval fields when status changes to pending
  IF NEW.status = 'pending' THEN
    NEW.approved_by = NULL;
    NEW.approved_at = NULL;
    NEW.rejection_reason = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for business transaction approval handling
DROP TRIGGER IF EXISTS business_transaction_approval_handler ON partner_transactions;
CREATE TRIGGER business_transaction_approval_handler
  BEFORE UPDATE ON partner_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_business_transaction_approval();

-- Add validation constraints for business transactions
ALTER TABLE partner_transactions 
DROP CONSTRAINT IF EXISTS valid_business_approval_status;

ALTER TABLE partner_transactions 
ADD CONSTRAINT valid_business_approval_status 
CHECK (
  (status = 'pending' AND approved_by IS NULL AND approved_at IS NULL) OR
  (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
  (status = 'rejected' AND approved_by IS NOT NULL)
);

-- Update RLS policies for business transactions with approval workflow
DROP POLICY IF EXISTS "Partners can update transactions involving themselves" ON partner_transactions;

CREATE POLICY "Partners can update transactions involving themselves"
  ON partner_transactions
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

-- Recalculate all partner balances based on sales and approved transactions only
DO $$
DECLARE
  partner_record RECORD;
BEGIN
  -- Reset all partner balances to 0 first
  UPDATE partners SET current_balance = 0;
  
  -- Add sales amounts to partner balances
  FOR partner_record IN 
    SELECT p.id, COALESCE(SUM(ds.total_amount), 0) as total_sales
    FROM partners p
    LEFT JOIN daily_sales ds ON ds.partner_id = p.id
    GROUP BY p.id
  LOOP
    UPDATE partners 
    SET current_balance = partner_record.total_sales
    WHERE id = partner_record.id;
  END LOOP;
  
  -- Add approved business transaction balances
  UPDATE partners 
  SET current_balance = current_balance + COALESCE((
    SELECT SUM(
      CASE 
        WHEN pt.to_partner_id = partners.id THEN pt.amount
        WHEN pt.from_partner_id = partners.id THEN -pt.amount
        ELSE 0
      END
    )
    FROM partner_transactions pt
    WHERE (pt.from_partner_id = partners.id OR pt.to_partner_id = partners.id)
    AND pt.status = 'approved'
  ), 0);
END $$;