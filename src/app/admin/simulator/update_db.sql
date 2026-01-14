-- 1. Update the Check Constraint for match_type to allow 'simulation'
-- We first drop the existing constraint (name might vary, but widely used defaults are checked)
ALTER TABLE draft_matches DROP CONSTRAINT IF EXISTS draft_matches_match_type_check;

-- Re-add the constraint with the new value
ALTER TABLE draft_matches ADD CONSTRAINT draft_matches_match_type_check 
CHECK (match_type IN ('scrim', 'scrim_summary', 'scrim_simulator', 'simulation'));

-- 2. Add the new columns for Draft Simulator v2
ALTER TABLE draft_matches ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE draft_matches ADD COLUMN IF NOT EXISTS ai_metadata jsonb;

-- Optional: Add index for slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_draft_matches_slug ON draft_matches(slug);
