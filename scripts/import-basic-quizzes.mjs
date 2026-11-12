import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function nanoid(length = 21) {
  const alphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
  let id = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    id += alphabet[randomValues[i] % alphabet.length];
  }
  return id;
}

export function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

function normalizeTitle(t) {
  return t.toLowerCase().replace(/\[true-false\]/i, '[true/false]').replace(/\s+/g, ' ').trim();
}

function cleanQuestionText(text) {
  if (!text) return '';
  return text.replace(/^"|"$/g, '').trim();
}

// 18 module mappings
const MODULE_MAPPINGS = [
  { folder: '01. Immunology & Mycology', title: 'Immunology & Mycology', nodeId: 'cmqaytck20003l204azibunno' },
  { folder: '02. Cell Injury Inflammation', title: 'Cell Injury Inflammation', nodeId: 'cmqayxdgt0008kw04s43h1qt0' },
  { folder: '03. Healing & Hemodynamics', title: 'Healing & Hemodynamics', nodeId: 'cmqayyylg000ekw04o523ccyt' },
  { folder: '04. Genetics Neoplasm', title: 'Genetics Neoplasm', nodeId: 'cmqaz05eo0007jr048k9pvhpw' },
  { folder: '05. Endocrine', title: 'Endocrine', nodeId: '97e75666-ee33-4af7-9486-d4faeb4643ab' },
  { folder: '06. Respiratory', title: 'Respiratory', nodeId: 'b3b11a34-8d14-4c86-b3e7-f2fd2a70a61b' },
  { folder: '07. Renal Acid Base', title: 'Renal Acid Base', nodeId: '67d86f90-d24f-4f0f-98e8-0390c3838c4b' },
  { folder: '08. Cardiovascular Physiology (CVS)', title: 'Cardiovascular Physiology (CVS)', nodeId: '06612816-2697-497f-b83a-3d230afea50e' },
  { folder: '09. GIT - Biochemistry', title: 'GIT - Biochemistry', nodeId: 'ad341227-3dcb-40f1-b753-3dab897d1d0c' },
  { folder: '10. Hematology', title: 'Hematology', nodeId: '088351f7-8d19-4eff-aeb8-3e452cdd690c' },
  { folder: '11. Neurophysiology', title: 'Neurophysiology', nodeId: '288909c5-7d93-4e24-942e-8d11d483e860' },
  { folder: '12. Neuroanatomy - Head & Neck', title: 'Neuroanatomy - Head & Neck', nodeId: '3f17e32b-8323-4894-939e-d7a7d378c253' },
  { folder: '13. Thorax (Extremity)', title: 'Thorax (Extremity)', nodeId: '8b0b7377-6ce0-4d9f-b904-c916d98b4020' },
  { folder: '14. Histology and Embrylogy', title: 'Histology and Embrylogy', nodeId: '1fa68982-8c41-4382-b575-39522a37ea07' },
  { folder: '15. Abdomen', title: 'Abdomen', nodeId: '5cf61331-334c-45aa-818d-c86076307232' },
  { folder: '16. Pharmacology', title: 'Pharmacology', nodeId: '1d45bbfc-d529-45b6-a2e8-79265c76578a' },
  { folder: '17. Bacteriology', title: 'Bacteriology', nodeId: '85a30c6b-ab51-489f-9c89-ca5a2239bffb' },
  { folder: '18. Viro Parasitology', title: 'Viro Parasitology', nodeId: '0c4dc5a9-5097-4ed5-a737-0d1358f0f153' }
];

const COURSE_ID = 'cmqbdpmmo0006jy04ew2tga32'; // Course "Basics"

async function run() {
  console.log(`\n======================================================`);
  console.log(`  IMPORTING BASIC QUESTIONS TO SUPABASE`);
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (No changes will be written)' : 'LIVE MIGRATION'}`);
  console.log(`======================================================\n`);

  // 1. Fetch all existing quizzes and questions
  const { data: dbQuizzes = [] } = await supabase.from('Quiz').select('*');
  const { data: dbCourseQuiz = [] } = await supabase.from('CourseQuiz').select('*').eq('courseId', COURSE_ID);

  console.log(`Loaded ${dbQuizzes.length} existing quizzes from DB.`);
  console.log(`Loaded ${dbCourseQuiz.length} existing CourseQuiz links for course "Basics".\n`);

  const dbQuizByNormTitle = new Map();
  dbQuizzes.forEach(q => {
    dbQuizByNormTitle.set(normalizeTitle(q.title), q);
  });

  const courseQuizByQuizId = new Map();
  dbCourseQuiz.forEach(cq => {
    courseQuizByQuizId.set(cq.quizId, cq);
  });

  const baseDir = 'Basic Questions';
  let totalQuizzesProcessed = 0;
  let totalQuizzesCreated = 0;
  let totalQuizzesUpdated = 0;
  let totalQuestionsInserted = 0;
  let totalQuestionsExisting = 0;
  let totalCourseQuizCreated = 0;
  let totalCourseQuizUpdated = 0;

  for (const moduleItem of MODULE_MAPPINGS) {
    const folderPath = path.join(baseDir, moduleItem.folder);
    if (!fs.existsSync(folderPath)) {
      console.warn(`Folder not found: ${folderPath}`);
      continue;
    }

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));
    console.log(`\n📁 [${moduleItem.folder}] -> Module Node: ${moduleItem.nodeId} (${files.length} quizzes)`);

    let sortOrder = 0;

    for (const file of files) {
      sortOrder++;
      totalQuizzesProcessed++;
      const rawTitle = file.replace(/\.csv$/, '').trim();
      const normTitle = normalizeTitle(rawTitle);

      const filePath = path.join(folderPath, file);
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const csvRows = parseCSV(csvContent);
      const dataRows = csvRows.slice(1);
      const questionCount = dataRows.length;

      const existingQuiz = dbQuizByNormTitle.get(normTitle);
      let quizId;
      let isNewQuiz = false;

      const quizData = {
        title: rawTitle,
        description: `Course: Basics | Module: ${moduleItem.title}`,
        durationMinutes: questionCount,
        numQuestionsToServe: questionCount,
        positionType: 'best_attempt',
        sbaMarks: 2,
        sbaNegative: 0,
        tfMarks: 2,
        tfNegative: 0,
        status: 'published',
        allowMultipleAttempts: true,
        shuffleQuestions: true,
        shuffleOptions: true,
        createdBy: 'cmnq6jcpm0000l705rxvhydbm',
        updatedAt: new Date().toISOString()
      };

      if (existingQuiz) {
        quizId = existingQuiz.id;
        totalQuizzesUpdated++;
        console.log(`  🔄 UPDATE Quiz: "${rawTitle}" (ID: ${quizId}) | Questions: ${questionCount}`);

        if (!isDryRun) {
          const { error: updateErr } = await supabase
            .from('Quiz')
            .update(quizData)
            .eq('id', quizId);
          if (updateErr) {
            console.error(`    ❌ Error updating Quiz ${quizId}:`, updateErr.message);
          }
        }
      } else {
        isNewQuiz = true;
        quizId = nanoid();
        totalQuizzesCreated++;
        console.log(`  ✨ CREATE Quiz: "${rawTitle}" (New ID: ${quizId}) | Questions: ${questionCount}`);

        if (!isDryRun) {
          const { error: insertErr } = await supabase
            .from('Quiz')
            .insert({
              id: quizId,
              createdAt: new Date().toISOString(),
              ...quizData
            });
          if (insertErr) {
            console.error(`    ❌ Error inserting Quiz ${quizId}:`, insertErr.message);
          }
        }
      }

      // Handle Questions
      let existingQuestions = [];
      if (!isNewQuiz) {
        const { data: qRows = [] } = await supabase
          .from('Question')
          .select('id, questionText')
          .eq('quizId', quizId);
        existingQuestions = qRows || [];
      }

      const existingQuestionTextSet = new Set(
        existingQuestions.map(q => cleanQuestionText(q.questionText).toLowerCase())
      );

      const questionsToInsert = [];

      for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
        const row = dataRows[rIdx];
        const questionText = cleanQuestionText(row[0]);
        if (!questionText) continue;

        const optA = cleanQuestionText(row[1]) || '';
        const optB = cleanQuestionText(row[2]) || '';
        const optC = cleanQuestionText(row[3]) || null;
        const optD = cleanQuestionText(row[4]) || null;
        const optE = cleanQuestionText(row[5]) || null;
        const correctOpt = (row[6] || '').trim().toUpperCase();
        const explanation = cleanQuestionText(row[7]) || null;

        // Determine question type:
        let questionType = 'sba';
        if (correctOpt.length > 1 && /[TF]/.test(correctOpt)) {
          questionType = 'true_false';
        } else if (rawTitle.toLowerCase().includes('true-false') || rawTitle.toLowerCase().includes('true/false')) {
          questionType = 'true_false';
        }

        // Check if question already exists in this quiz
        if (existingQuestionTextSet.has(questionText.toLowerCase())) {
          totalQuestionsExisting++;
          continue; // Keep existing question intact with its ID
        }

        questionsToInsert.push({
          id: nanoid(),
          quizId: quizId,
          questionText: questionText,
          questionType: questionType,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          optionE: optE,
          correctOption: correctOpt,
          explanation: explanation,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      if (questionsToInsert.length > 0) {
        totalQuestionsInserted += questionsToInsert.length;
        console.log(`    ➕ Adding ${questionsToInsert.length} new question(s)...`);

        if (!isDryRun) {
          // Batch in chunks of 100
          for (let c = 0; c < questionsToInsert.length; c += 100) {
            const chunk = questionsToInsert.slice(c, c + 100);
            const { error: qInsertErr } = await supabase.from('Question').insert(chunk);
            if (qInsertErr) {
              console.error(`    ❌ Error inserting question chunk for quiz ${quizId}:`, qInsertErr.message);
            }
          }
        }
      } else {
        console.log(`    ✔ All ${dataRows.length} questions already present.`);
      }

      // Handle CourseQuiz link
      const existingCQ = courseQuizByQuizId.get(quizId);
      if (existingCQ) {
        if (existingCQ.curriculumNodeId !== moduleItem.nodeId) {
          totalCourseQuizUpdated++;
          console.log(`    🔗 Re-linking CourseQuiz ${existingCQ.id} to node ${moduleItem.nodeId}`);
          if (!isDryRun) {
            await supabase
              .from('CourseQuiz')
              .update({ curriculumNodeId: moduleItem.nodeId, sortOrder: sortOrder })
              .eq('id', existingCQ.id);
          }
        }
      } else {
        totalCourseQuizCreated++;
        console.log(`    🔗 Creating CourseQuiz link to node ${moduleItem.nodeId}`);
        if (!isDryRun) {
          const { error: cqErr } = await supabase.from('CourseQuiz').insert({
            id: nanoid(),
            quizId: quizId,
            courseId: COURSE_ID,
            curriculumNodeId: moduleItem.nodeId,
            sortOrder: sortOrder
          });
          if (cqErr) {
            console.error(`    ❌ Error creating CourseQuiz for ${quizId}:`, cqErr.message);
          }
        }
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`  MIGRATION SUMMARY ${isDryRun ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`======================================================`);
  console.log(`Total Quizzes Processed:    ${totalQuizzesProcessed}`);
  console.log(`Quizzes Created (New):      ${totalQuizzesCreated}`);
  console.log(`Quizzes Updated (Existing): ${totalQuizzesUpdated}`);
  console.log(`Questions Inserted (New):   ${totalQuestionsInserted}`);
  console.log(`Questions Preserved (Exist):${totalQuestionsExisting}`);
  console.log(`CourseQuiz Links Created:   ${totalCourseQuizCreated}`);
  console.log(`CourseQuiz Links Realigned: ${totalCourseQuizUpdated}`);
  console.log(`======================================================\n`);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
