-- Allow uniform fee variants in fee_structures
ALTER TABLE fee_structures DROP CONSTRAINT IF EXISTS fee_structures_fee_type_check;

ALTER TABLE fee_structures
ADD CONSTRAINT fee_structures_fee_type_check
CHECK (
  fee_type IN (
    'registration',
    'tuition',
    'materials',
    'transport',
    'meals',
    'uniform',
    'uniform_tshirt',
    'uniform_shorts',
    'activity',
    'other'
  )
);
