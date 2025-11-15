const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './web/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? 'found' : 'missing');
  console.log('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'found' : 'missing');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CAPS_BOOKS_DIR = '/media/king/0758576e-6f1e-485f-b9e0-00b44a1d3259/home/king/Desktop/edudashpro/CAPS/TEXT_BOOKS';

// Helper function to parse book information from filename
function parseBookInfo(filename) {
  // Remove .pdf extension
  const name = filename.replace('.pdf', '');

  // Parse grade - handle patterns like "Gr4A", "Gr7", "Gr10"
  let grade = '';
  let gradeMatch = name.match(/Gr(\d+[A-B]?)/);
  if (gradeMatch) {
    grade = gradeMatch[1];
    // Convert grade format (Gr4A -> Grade 4A, Gr10 -> Grade 10)
    if (grade.includes('A') || grade.includes('B')) {
      grade = `Grade ${grade}`;
    } else {
      grade = `Grade ${grade}`;
    }
  }

  // Parse language (Afrikaans vs English)
  let language = 'English';
  if (name.toLowerCase().includes('afr')) {
    language = 'Afrikaans';
  }

  // Parse subject from filename
  let subject = 'General';
  let title = name;

  if (name.toLowerCase().includes('mathematical')) {
    subject = 'Mathematical Literacy';
    title = `Mathematical Literacy Learner Book (${grade})`;
  } else if (name.toLowerCase().includes('mathematics') || name.toLowerCase().includes('math')) {
    subject = 'Mathematics';
    title = `Mathematics Learner Book (${grade})`;
  } else if (name.toLowerCase().includes('naturalsciences') || name.toLowerCase().includes('natural')) {
    subject = 'Natural Sciences';
    title = `Natural Sciences Learner Book (${grade})`;
  } else if (name.includes('_A_')) {
    subject = 'General';
    title = `Learner Book A (${grade})`;
  } else if (name.includes('_B_')) {
    subject = 'General';
    title = `Learner Book B (${grade})`;
  }

  // Determine grade range for easier querying
  let gradeRange = '';
  if (grade.includes('4') || grade.includes('5') || grade.includes('6')) {
    gradeRange = '4-6'; // Intermediate Phase
  } else if (grade.includes('7') || grade.includes('8') || grade.includes('9')) {
    gradeRange = '7-9'; // Senior Phase
  } else if (grade.includes('10')) {
    gradeRange = '10-12'; // FET Phase
  }

  return {
    title,
    subject,
    grade,
    gradeRange,
    language,
    filename,
    filePath: path.join(CAPS_BOOKS_DIR, filename)
  };
}

async function createBooksTable() {
  try {
    console.log('📚 Creating books table if it doesn\'t exist...');

    // Try to create the table with proper structure
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS books (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          subject TEXT NOT NULL,
          grade TEXT NOT NULL,
          grade_range TEXT,
          language TEXT DEFAULT 'English',
          file_path TEXT NOT NULL,
          file_url TEXT,
          file_size BIGINT,
          pages INTEGER,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Add indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_books_subject ON books(subject);
        CREATE INDEX IF NOT EXISTS idx_books_grade ON books(grade);
        CREATE INDEX IF NOT EXISTS idx_books_grade_range ON books(grade_range);

        -- Enable RLS
        ALTER TABLE books ENABLE ROW LEVEL SECURITY;

        -- Create policy for public read access
        CREATE POLICY IF NOT EXISTS "Public read access" ON books
          FOR SELECT USING (true);

        -- Create policy for service role insert
        CREATE POLICY IF NOT EXISTS "Service role insert" ON books
          FOR INSERT WITH CHECK (true);

        -- Create policy for service role update
        CREATE POLICY IF NOT EXISTS "Service role update" ON books
          FOR UPDATE USING (true);

        -- Create policy for service role delete
        CREATE POLICY IF NOT EXISTS "Service role delete" ON books
          FOR DELETE USING (true);
      `
    });

    if (createError) {
      console.log('⚠️  Table creation error (might already exist):', createError.message);
    } else {
      console.log('✅ Books table created successfully');
    }

  } catch (error) {
    console.log('⚠️  RPC exec_sql not available, table might already exist');
  }
}

async function seedBooks() {
  try {
    console.log('📚 Starting CAPS Books Seeding Process...\n');

    // Create books table first
    await createBooksTable();

    // Read the CAPS books directory
    const files = fs.readdirSync(CAPS_BOOKS_DIR);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));

    console.log(`📄 Found ${pdfFiles.length} PDF books to process\n`);

    let successCount = 0;
    let errorCount = 0;
    let totalSize = 0;

    for (const file of pdfFiles) {
      try {
        const bookInfo = parseBookInfo(file);

        // Get file size
        const stats = fs.statSync(bookInfo.filePath);
        const fileSize = stats.size;
        totalSize += fileSize;

        console.log(`📖 Processing: ${file}`);
        console.log(`   Subject: ${bookInfo.subject}`);
        console.log(`   Grade: ${bookInfo.grade}`);
        console.log(`   Language: ${bookInfo.language}`);
        console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Check if book already exists
        const { data: existingBook } = await supabase
          .from('books')
          .select('id')
          .eq('title', bookInfo.title)
          .eq('subject', bookInfo.subject)
          .eq('grade', bookInfo.grade)
          .single();

        if (existingBook) {
          console.log(`   ⚠️  Book already exists in database, skipping...\n`);
          continue;
        }

        // Insert the book into database
        const { data, error } = await supabase
          .from('books')
          .insert({
            title: bookInfo.title,
            subject: bookInfo.subject,
            grade: bookInfo.grade,
            grade_range: bookInfo.gradeRange,
            language: bookInfo.language,
            file_path: bookInfo.filePath,
            file_size: fileSize,
            description: `CAPS-aligned ${bookInfo.subject} learner book for ${bookInfo.grade}`
          })
          .select();

        if (error) {
          console.log(`   ❌ Error inserting book: ${error.message}\n`);
          errorCount++;
        } else {
          console.log(`   ✅ Book inserted successfully (ID: ${data[0].id})\n`);
          successCount++;
        }

      } catch (fileError) {
        console.log(`   ❌ Error processing ${file}: ${fileError.message}\n`);
        errorCount++;
      }
    }

    console.log('🎯 Seeding Summary:');
    console.log(`✅ Successfully seeded: ${successCount} books`);
    console.log(`❌ Errors: ${errorCount} books`);
    console.log(`📚 Total books processed: ${pdfFiles.length}`);
    console.log(`💾 Total file size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Verify the seeding
    console.log('\n🔍 Verifying seeded books...');
    const { data: books, error: verifyError } = await supabase
      .from('books')
      .select('subject, grade, language, title')
      .order('subject, grade');

    if (verifyError) {
      console.log('❌ Verification error:', verifyError.message);
    } else {
      console.log(`✅ Verification successful! Found ${books?.length || 0} books in database`);

      // Group by subject
      const subjectCounts = {};
      books?.forEach(book => {
        subjectCounts[book.subject] = (subjectCounts[book.subject] || 0) + 1;
      });

      console.log('\n📚 Books by subject:');
      Object.entries(subjectCounts).forEach(([subject, count]) => {
        console.log(`  ${subject}: ${count} books`);
      });
    }

    // Current coverage analysis
    console.log('\n📊 CAPS Library Coverage Analysis:');
    console.log(`📖 Current textbooks: ${books?.length || 0}`);
    console.log(`🎯 Estimated needed for complete library: ~550 textbooks`);
    console.log(`📈 Current coverage: ${((books?.length || 0) / 550 * 100).toFixed(1)}%`);

    console.log('\n🚀 Next steps:');
    console.log('1. Add Physical Sciences and Life Sciences textbooks');
    console.log('2. Add Accounting, Business Studies, Economics textbooks');
    console.log('3. Add Foundation Phase (Grades R-3) textbooks');
    console.log('4. Add First Additional Language textbooks');
    console.log('5. Add teacher guides and workbooks');

  } catch (error) {
    console.error('❌ Fatal error during seeding:', error.message);
    process.exit(1);
  }
}

// Run the seeding
seedBooks();