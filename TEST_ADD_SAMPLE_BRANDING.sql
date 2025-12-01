-- Test: Add sample report card branding to Young Eagles
-- Run this to test the branding feature

UPDATE preschools
SET 
  logo_url = 'https://via.placeholder.com/200x100/8b5cf6/ffffff?text=Young+Eagles',
  settings = jsonb_build_object(
    'report_card_header', 'Student Progress Report',
    'report_card_footer', 'This report is confidential and should be discussed with parents/guardians.',
    'principal_name', 'Principal Elsha',
    'principal_signature_url', '',
    'show_logo', true,
    'show_address', true,
    'show_contact', true,
    'show_principal_signature', true,
    'whatsapp_number', '+15551427341'
  ),
  updated_at = NOW()
WHERE id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';

-- Verify the update
SELECT 
  name,
  logo_url,
  settings->'report_card_header' as header,
  settings->'principal_name' as principal,
  settings->'show_logo' as show_logo
FROM preschools
WHERE id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';
