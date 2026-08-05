-- Powerbases Table
CREATE TABLE IF NOT EXISTS public.powerbases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    roblox_group_id TEXT,
    leader_id TEXT NOT NULL, -- Discord ID
    tier INTEGER NOT NULL DEFAULT 1,
    prestige INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, ACTIVE, PENDING_DISSOLUTION, DISSOLVED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Powerbase Members Table
CREATE TABLE IF NOT EXISTS public.powerbase_members (
    powerbase_id UUID NOT NULL REFERENCES public.powerbases(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Discord ID
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    PRIMARY KEY (powerbase_id, user_id)
);

-- Powerbase Logs Table
CREATE TABLE IF NOT EXISTS public.powerbase_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Discord ID of actor
    powerbase_id UUID REFERENCES public.powerbases(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Enable RLS (Optional depending on how you've set up other tables, but good practice)
ALTER TABLE public.powerbases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.powerbase_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.powerbase_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users (assuming Supabase standard)
CREATE POLICY "Allow public read access to powerbases" ON public.powerbases FOR SELECT USING (true);
CREATE POLICY "Allow public read access to powerbase_members" ON public.powerbase_members FOR SELECT USING (true);
CREATE POLICY "Allow public read access to powerbase_logs" ON public.powerbase_logs FOR SELECT USING (true);

-- Assuming the bot connects with service_role, it will bypass RLS for inserts/updates.
-- If the web UI needs to update records directly (e.g., admin approvals), we will use an API route using the service_role key.
