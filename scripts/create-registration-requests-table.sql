-- Create registration_requests table in EduDashPro to sync with EduSitePro
-- This allows real-time access to registration data without cross-database queries

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.registration_requests CASCADE;

-- Create the table matching EduSitePro schema
CREATE TABLE public.registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    
    -- Guardian information
    guardian_name TEXT NOT NULL,
    guardian_email TEXT NOT NULL,
    guardian_phone TEXT NOT NULL,
    guardian_address TEXT,
    guardian_id_document_url TEXT,
    
    -- Student information
    student_first_name TEXT NOT NULL,
    student_last_name TEXT NOT NULL,
    student_dob DATE NOT NULL,
    student_gender TEXT CHECK (student_gender IN ('male', 'female', 'other')),
    student_birth_certificate_url TEXT,
    student_clinic_card_url TEXT,
    
    -- Documents tracking
    documents_uploaded BOOLEAN DEFAULT FALSE,
    documents_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Payment information
    registration_fee_amount NUMERIC(10, 2),
    registration_fee_paid BOOLEAN DEFAULT FALSE,
    payment_method TEXT,
    proof_of_payment_url TEXT,
    campaign_applied TEXT,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    
    -- Status and review
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Sync tracking
    synced_from_edusite BOOLEAN DEFAULT FALSE,
    edusite_id UUID, -- Original ID from EduSitePro
    synced_at TIMESTAMP WITH TIME ZONE,
    
    -- After approval, link to created records
    edudash_student_id UUID REFERENCES public.students(id),
    edudash_parent_id UUID REFERENCES public.profiles(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_registration_requests_organization ON public.registration_requests(organization_id);
CREATE INDEX idx_registration_requests_status ON public.registration_requests(status);
CREATE INDEX idx_registration_requests_edusite_id ON public.registration_requests(edusite_id);
CREATE INDEX idx_registration_requests_created_at ON public.registration_requests(created_at DESC);

-- Add RLS policies
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Principals can see registrations for their preschool
CREATE POLICY "Principals see own school registrations"
    ON public.registration_requests
    FOR SELECT
    USING (
        organization_id IN (
            SELECT preschool_id 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'principal'
        )
    );

-- Policy: Principals can update registrations for their preschool
CREATE POLICY "Principals manage own school registrations"
    ON public.registration_requests
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT preschool_id 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'principal'
        )
    );

-- Policy: SuperAdmins can see all registrations
CREATE POLICY "SuperAdmins see all registrations"
    ON public.registration_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 
            FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'superadmin'
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_registration_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_registration_requests_timestamp
    BEFORE UPDATE ON public.registration_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_registration_requests_updated_at();

-- Add comment
COMMENT ON TABLE public.registration_requests IS 'Student registration requests synced from EduSitePro website';
