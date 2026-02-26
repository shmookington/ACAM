-- Purge all stale leads from before the workflow redesign
-- These were auto-saved by the old scraper behavior
DELETE FROM leads;
DELETE FROM outreach;
