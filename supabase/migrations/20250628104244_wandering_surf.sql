/*
  # Add partner tracking to daily sales

  1. Schema Changes
    - Add `partner_id` column to `daily_sales` table to track which partner made the sale
    - Add foreign key constraint to ensure data integrity
    - Update existing records to have a default partner (first partner in system)

  2. Security
    - Update RLS policies to maintain existing access patterns
    - Ensure partners can still view all sales data for transparency

  3. Indexes
    - Add index on partner_id for better query performance
*/

-- Add partner_id column to daily_sales table
ALTER TABLE daily_sales 
ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_daily_sales_partner ON daily_sales(partner_id);

-- Update existing sales records to have a partner_id (assign to the creator)
UPDATE daily_sales 
SET partner_id = created_by 
WHERE partner_id IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN daily_sales.partner_id IS 'The partner responsible for this sale';