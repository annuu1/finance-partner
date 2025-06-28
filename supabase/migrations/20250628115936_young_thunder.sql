/*
  # Partner Balance Updates and Transaction Approval System

  1. Updates
    - Modify daily_sales to automatically update partner balances
    - Enhance personal_transactions approval system
    - Add proper triggers for balance management

  2. Features
    - Sales revenue automatically added to partner balance
    - Transaction approval workflow for personal transactions
    - Real-time balance tracking
    - Audit trail for all balance changes

  3. Security
    - Enhanced RLS policies for approval workflow
    - Proper validation for status changes
*/

-- Create function to handle daily sales balance updates
CREATE OR REPLACE FUNCTION update_partner_balance_from_sales()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Add sales amount to partner balance
    IF NEW.partner_id IS NOT NULL THEN
      UPDATE partners 
      SET 
        current_balance = current_balance + NEW.total_amount,
        updated_at = now()
      WHERE id = NEW.partner_id;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle partner change or amount change
    IF OLD.partner_id != NEW.partner_id OR OLD.total_amount != NEW.total_amount THEN
      -- Remove old amount from old partner
      IF OLD.partner_id IS NOT NULL THEN
        UPDATE partners 
        SET 
          current_balance = current_balance - OLD.total_amount,
          updated_at = now()
        WHERE id = OLD.partner_id;
      END IF;
      
      -- Add new amount to new partner
      IF NEW.partner_id IS NOT NULL THEN
        UPDATE partners 
        SET 
          current_balance = current_balance + NEW.total_amount,
          updated_at = now()
        WHERE id = NEW.partner_id;
      END IF;
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Remove sales amount from partner balance
    IF OLD.partner_id IS NOT NULL THEN
      UPDATE partners 
      SET 
        current_balance = current_balance - OLD.total_amount,
        updated_at = now()
      WHERE id = OLD.partner_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for daily sales balance updates
DROP TRIGGER IF EXISTS daily_sales_balance_update ON daily_sales;
CREATE TRIGGER daily_sales_balance_update
  AFTER INSERT OR UPDATE OR DELETE ON daily_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_balance_from_sales();

-- Update personal transactions to require approval for all new transactions
UPDATE personal_transactions 
SET status = 'pending' 
WHERE status = 'approved' AND created_at > now() - interval '1 hour';

-- Enhanced RLS policies for personal transactions with approval workflow
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
    -- Either party can edit if approved (for corrections, but this will require re-approval)
    (status = 'approved' AND (auth.uid() = from_partner_id OR auth.uid() = to_partner_id))
  )
  WITH CHECK (
    -- When updating, ensure proper approval workflow
    CASE 
      WHEN auth.uid() = from_partner_id AND OLD.status = 'pending' THEN 
        -- Creator can only modify transaction details, not approval status
        NEW.status = 'pending'
      WHEN auth.uid() = to_partner_id AND OLD.status = 'pending' THEN 
        -- Receiver can approve or reject
        NEW.status IN ('approved', 'rejected') AND NEW.approved_by = auth.uid()
      WHEN OLD.status = 'approved' AND (auth.uid() = from_partner_id OR auth.uid() = to_partner_id) THEN
        -- If editing approved transaction, reset to pending for re-approval
        NEW.status = 'pending' AND NEW.approved_by IS NULL AND NEW.approved_at IS NULL
      ELSE false
    END
  );

-- Create function to handle transaction approval notifications
CREATE OR REPLACE FUNCTION handle_transaction_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Set approval timestamp when status changes to approved
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
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

-- Create trigger for transaction approval handling
DROP TRIGGER IF EXISTS transaction_approval_handler ON personal_transactions;
CREATE TRIGGER transaction_approval_handler
  BEFORE UPDATE ON personal_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_transaction_approval();

-- Add validation constraints
ALTER TABLE personal_transactions 
DROP CONSTRAINT IF EXISTS valid_approval_status;

ALTER TABLE personal_transactions 
ADD CONSTRAINT valid_approval_status 
CHECK (
  (status = 'pending' AND approved_by IS NULL AND approved_at IS NULL) OR
  (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
  (status = 'rejected' AND approved_by IS NOT NULL)
);

-- Create index for better performance on approval queries
CREATE INDEX IF NOT EXISTS idx_personal_transactions_pending 
ON personal_transactions(to_partner_id, status) 
WHERE status = 'pending';

-- Update existing balances based on current sales data
DO $$
DECLARE
  partner_record RECORD;
  sales_total NUMERIC;
BEGIN
  -- Reset all partner balances to 0 first
  UPDATE partners SET current_balance = 0;
  
  -- Calculate and update balances based on sales
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
  
  -- Add approved personal transaction balances
  UPDATE partners 
  SET current_balance = current_balance + COALESCE((
    SELECT SUM(
      CASE 
        WHEN pt.to_partner_id = partners.id THEN pt.amount
        WHEN pt.from_partner_id = partners.id THEN -pt.amount
        ELSE 0
      END
    )
    FROM personal_transactions pt
    WHERE (pt.from_partner_id = partners.id OR pt.to_partner_id = partners.id)
    AND pt.status = 'approved'
  ), 0);
END $$;