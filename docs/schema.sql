-- ACAM Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  category TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  google_rating REAL,
  review_count INTEGER DEFAULT 0,
  has_website BOOLEAN DEFAULT false,
  website_url TEXT,
  website_quality TEXT DEFAULT 'none',
  google_maps_url TEXT,
  lead_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'new',
  scraped_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Outreach table
CREATE TABLE IF NOT EXISTS outreach (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  email_subject TEXT,
  email_body TEXT,
  email_type TEXT DEFAULT 'initial',
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pipeline events table
CREATE TABLE IF NOT EXISTS pipeline_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT,
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Portfolio table
CREATE TABLE IF NOT EXISTS portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT,
  industry TEXT,
  description TEXT,
  before_url TEXT,
  after_url TEXT,
  showcase_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Settings table (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_outreach_lead_id ON outreach(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_lead_id ON pipeline_events(lead_id);

-- Enable Row Level Security (but allow all for authenticated users)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: allow authenticated users full access
CREATE POLICY "Allow all for authenticated" ON leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON outreach FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON pipeline_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON portfolio FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON settings FOR ALL USING (auth.role() = 'authenticated');
