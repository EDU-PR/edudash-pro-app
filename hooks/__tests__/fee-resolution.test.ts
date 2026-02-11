import { resolveTuitionFeeStructure } from '@/lib/utils/feeStructureSelector';

describe('resolveTuitionFeeStructure', () => {
  const baseStructures = [
    {
      id: 'fee-r720',
      amount: 720,
      name: 'Grade R Tuition',
      description: 'Grade R tuition fee',
      fee_type: 'tuition',
      grade_levels: ['Grade R'],
      effective_from: '2026-01-01',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'fee-r850',
      amount: 850,
      name: 'Grade 1 Tuition',
      description: 'Grade 1 tuition fee',
      fee_type: 'tuition',
      grade_levels: ['Grade 1'],
      effective_from: '2026-01-01',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('returns matched for exact grade/class context', () => {
    const result = resolveTuitionFeeStructure(baseStructures, {
      gradeLevel: 'Grade R',
      ageGroupLabel: 'Grade R',
      dateOfBirth: '2021-02-10',
      enrollmentDate: '2026-01-15',
    });

    expect(result.status).toBe('matched');
    expect(result.fee?.id).toBe('fee-r720');
    expect(result.reason).toBe('grade_level_exact');
  });

  it('returns ambiguous when multiple structures match same grade', () => {
    const ambiguousStructures = [
      {
        ...baseStructures[0],
        id: 'fee-r720-a',
      },
      {
        ...baseStructures[0],
        id: 'fee-r720-b',
        created_at: '2026-02-01T00:00:00.000Z',
      },
    ];

    const result = resolveTuitionFeeStructure(ambiguousStructures, {
      gradeLevel: 'Grade R',
      ageGroupLabel: 'Grade R',
    });

    expect(result.status).toBe('ambiguous');
    expect(result.reason).toContain('multiple_grade_level_matches');
    expect(result.matches?.length).toBe(2);
  });

  it('returns unmatched when no context can resolve deterministically', () => {
    const result = resolveTuitionFeeStructure(baseStructures, {
      gradeLevel: null,
      ageGroupLabel: null,
      dateOfBirth: null,
      enrollmentDate: null,
    });

    expect(result.status).toBe('unmatched');
    expect(result.reason).toBe('insufficient_context_missing_grade_class_and_age');
    expect(result.fee).toBeUndefined();
  });
});
