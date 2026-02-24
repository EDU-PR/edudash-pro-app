import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type UniformRow = {
  id: string;
  preschool_id: string;
  child_name: string | null;
  tshirt_number: string | null;
};

const normalizeBackNumber = (value: unknown): string => String(value ?? '').trim();

const parseBackNumber = (value: unknown): number | null => {
  const normalized = normalizeBackNumber(value);
  if (!/^\d{1,2}$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) return null;
  return parsed;
};

async function main() {
  // Fetch all uniform_requests with basic fields
  const { data, error } = await supabase
    .from('uniform_requests')
    .select('id, preschool_id, child_name, tshirt_number')
    .order('preschool_id', { ascending: true });

  if (error) {
    console.error('❌ Error fetching uniform_requests:', error.message);
    process.exit(1);
  }

  const rows: UniformRow[] = Array.isArray(data) ? (data as UniformRow[]) : [];

  if (!rows.length) {
    console.log('✅ No uniform_requests rows found.');
    return;
  }

  type PreschoolSummary = {
    preschoolId: string;
    totalOrders: number;
    withValidNumber: number;
    missingOrInvalid: number;
    duplicateNumbers: { number: number; count: number; childNames: string[] }[];
  };

  const byPreschool = new Map<string, UniformRow[]>();
  for (const row of rows) {
    const list = byPreschool.get(row.preschool_id) || [];
    list.push(row);
    byPreschool.set(row.preschool_id, list);
  }

  const summaries: PreschoolSummary[] = [];

  for (const [preschoolId, list] of byPreschool.entries()) {
    const numberUsage = new Map<number, string[]>();
    let withValidNumber = 0;
    let missingOrInvalid = 0;

    for (const row of list) {
      const parsed = parseBackNumber(row.tshirt_number);
      if (parsed === null) {
        missingOrInvalid += 1;
        continue;
      }
      withValidNumber += 1;
      const names = numberUsage.get(parsed) || [];
      names.push(row.child_name || row.id);
      numberUsage.set(parsed, names);
    }

    const duplicateNumbers: PreschoolSummary['duplicateNumbers'] = [];
    for (const [num, names] of numberUsage.entries()) {
      if (names.length > 1) {
        duplicateNumbers.push({
          number: num,
          count: names.length,
          childNames: names,
        });
      }
    }

    summaries.push({
      preschoolId,
      totalOrders: list.length,
      withValidNumber,
      missingOrInvalid,
      duplicateNumbers: duplicateNumbers.sort((a, b) => a.number - b.number),
    });
  }

  let hasIssues = false;

  for (const summary of summaries.sort((a, b) => a.preschoolId.localeCompare(b.preschoolId))) {
    console.log('──────────────────────────────');
    console.log(`Preschool: ${summary.preschoolId}`);
    console.log(`Total uniform orders: ${summary.totalOrders}`);
    console.log(`With valid 1–2 digit number: ${summary.withValidNumber}`);
    console.log(`Missing/invalid number: ${summary.missingOrInvalid}`);

    if (summary.duplicateNumbers.length === 0 && summary.missingOrInvalid === 0) {
      console.log('✅ All orders have unique 1–2 digit numbers (1–99).');
    } else {
      hasIssues = true;
      if (summary.missingOrInvalid > 0) {
        console.log('⚠️  Orders missing or with invalid numbers (not 1–2 digits 1–99):', summary.missingOrInvalid);
      }
      if (summary.duplicateNumbers.length > 0) {
        console.log('⚠️  Duplicate numbers:');
        for (const dup of summary.duplicateNumbers) {
          console.log(
            `  - #${dup.number} used ${dup.count}× by: ${dup.childNames.join(', ')}`,
          );
        }
      }
    }
  }

  console.log('──────────────────────────────');
  if (hasIssues) {
    console.log('⚠️  Uniform number validation completed with issues. See details above.');
    process.exitCode = 1;
  } else {
    console.log('✅ Uniform numbers look good across all preschools (unique 1–99 and no missing).');
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

