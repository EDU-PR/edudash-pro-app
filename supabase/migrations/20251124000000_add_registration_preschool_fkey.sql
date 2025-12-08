-- Add foreign key relationship between registration_requests and preschools
-- This resolves the PGRST200 error when querying registration_requests with preschools join
-- Note: registration_requests uses organization_id to reference preschools

ALTER TABLE public.registration_requests 
ADD CONSTRAINT registration_requests_organization_id_fkey 
FOREIGN KEY (organization_id) REFERENCES public.preschools(id) 
ON DELETE CASCADE;
