/*
  # Add INSERT policy for partners table

  1. Security Changes
    - Add policy to allow authenticated users to insert their own partner profile
    - This enables new user sign-up to create partner records successfully

  The policy ensures users can only create a partner record with their own user ID,
  maintaining security while allowing the sign-up process to complete.
*/

CREATE POLICY "Partners can insert their own profile"
  ON partners
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);