-- Add tournament_id column to draft_matches table
ALTER TABLE draft_matches ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES tournaments(id);

-- Add index for tournament_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_draft_matches_tournament_id ON draft_matches(tournament_id);
