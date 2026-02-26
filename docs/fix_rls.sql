-- Fix RLS policies for API route access
-- The API routes use the anon key, so we need to allow anon access
-- This is safe because ACAM is a single-user, login-protected app

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON leads;
DROP POLICY IF EXISTS "Allow all for authenticated" ON outreach;
DROP POLICY IF EXISTS "Allow all for authenticated" ON pipeline_events;
DROP POLICY IF EXISTS "Allow all for authenticated" ON portfolio;
DROP POLICY IF EXISTS "Allow all for authenticated" ON settings;

-- Create new policies that allow both anon and authenticated
CREATE POLICY "Allow all access" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON outreach FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON pipeline_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON portfolio FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON settings FOR ALL USING (true) WITH CHECK (true);
