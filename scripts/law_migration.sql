-- Migration for Council Proposals and Law Sections

-- 1. Alter council_proposals
ALTER TABLE council_proposals
ADD COLUMN IF NOT EXISTS authors text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS co_authors text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS legal_format boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS amendment_iteration integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_bill_id uuid REFERENCES council_proposals(id) ON DELETE SET NULL;

-- 2. Create law_sections table
CREATE TABLE IF NOT EXISTS law_sections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    document_type text NOT NULL, -- 'constitution' or 'sith_codex'
    article_number text,
    section_number text,
    title text,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_law_sections_document_type ON law_sections(document_type);

-- RLS Policies (assuming standard authenticated read/write depending on your setup)
ALTER TABLE law_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to law_sections" 
ON law_sections FOR SELECT USING (true);
