-- Create the admin_invites table
CREATE TABLE IF NOT EXISTS public.admin_invites (
    _id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL,
    created_by UUID NOT NULL REFERENCES public.admin_users(_id) ON DELETE CASCADE,
    is_used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Protect table with RLS
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Give full access to service role, no access to public/anon
CREATE POLICY "Enable service role access for admin_invites" 
ON public.admin_invites 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
