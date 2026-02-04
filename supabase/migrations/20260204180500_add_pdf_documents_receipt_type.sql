-- Allow receipt as a valid pdf_documents document_type

BEGIN;

ALTER TABLE public.pdf_documents
  DROP CONSTRAINT IF EXISTS pdf_documents_document_type_check;

ALTER TABLE public.pdf_documents
  ADD CONSTRAINT pdf_documents_document_type_check
  CHECK (document_type IN (
    'report',
    'letter',
    'invoice',
    'study_guide',
    'lesson_plan',
    'progress_report',
    'assessment',
    'certificate',
    'newsletter',
    'worksheet',
    'general',
    'receipt'
  ));

COMMIT;
