/**
 * ClearDoc Smoke Test
 * Tests sample-document.txt against the active AI provider (Google AI Studio Gemma 4 or local Ollama).
 * Checks that all 5 sections plus $184.50, November 3, and Amoxicillin appear in the output.
 * Prints PASS or FAIL.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { explainDocument } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSmokeTest() {
  console.log('\n======================================================');
  console.log('🧪 Starting ClearDoc Smoke Test');
  console.log('======================================================\n');

  // 1. Read sample document
  const samplePath = path.join(__dirname, 'sample-document.txt');
  if (!fs.existsSync(samplePath)) {
    console.error('❌ FAIL: sample-document.txt not found at', samplePath);
    process.exit(1);
  }

  const sampleText = fs.readFileSync(samplePath, 'utf8');
  console.log(`📄 Loaded sample document (${sampleText.length} characters)`);

  const provider = (process.env.PROVIDER || 'api').toLowerCase();
  const model = provider === 'local' 
    ? (process.env.OLLAMA_MODEL || 'gemma4:e2b') 
    : (process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it');

  console.log(`🤖 Active Provider : ${provider.toUpperCase()}`);
  console.log(`🧠 Model           : ${model}`);
  console.log('⏳ Sending document to Gemma 4 for plain-language explanation...\n');

  let result;
  const startTime = Date.now();
  try {
    result = await explainDocument({
      text: sampleText,
      language: 'English',
      provider,
    });
  } catch (err) {
    console.error('❌ FAIL: Error during explanation call:');
    console.error(err.message);
    process.exit(1);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱️ Response received in ${durationSec}s\n`);

  const fullOutput = result.output || '';

  // Required checks
  const checks = [
    { name: 'Section 1: WHAT IT SAYS', test: (txt) => /WHAT\s+IT\s+SAYS/i.test(txt) },
    { name: 'Section 2: WHAT YOU NEED TO DO', test: (txt) => /WHAT\s+YOU\s+NEED\s+TO\s+DO/i.test(txt) },
    { name: 'Section 3: DEADLINES, AMOUNTS, AND DOSAGES', test: (txt) => /DEADLINES/i.test(txt) && (/AMOUNTS/i.test(txt) || /DOSAGES/i.test(txt)) },
    { name: 'Section 4: WHAT TO WATCH OUT FOR', test: (txt) => /WHAT\s+TO\s+WATCH\s+OUT\s+FOR/i.test(txt) },
    { name: 'Section 5: QUESTIONS TO ASK', test: (txt) => /QUESTIONS\s+TO\s+ASK/i.test(txt) },
    { name: 'Exact Bill Amount: $184.50', test: (txt) => txt.includes('184.50') || txt.includes('$184.50') },
    { name: 'Exact Deadline: November 3', test: (txt) => /November\s+3/i.test(txt) },
    { name: 'Exact Medication: Amoxicillin', test: (txt) => /Amoxicillin/i.test(txt) },
  ];

  console.log('------------------------------------------------------');
  console.log('📋 Verification Checklist:');
  console.log('------------------------------------------------------');

  let allPassed = true;
  for (const check of checks) {
    const passed = check.test(fullOutput);
    if (passed) {
      console.log(`  ✅ [PASS] ${check.name}`);
    } else {
      console.log(`  ❌ [FAIL] ${check.name}`);
      allPassed = false;
    }
  }

  console.log('------------------------------------------------------\n');

  if (allPassed) {
    console.log('======================================================');
    console.log('🎉 RESULT: PASS');
    console.log('All 5 sections and critical items ($184.50, November 3, Amoxicillin) verified!');
    console.log('======================================================\n');
    process.exit(0);
  } else {
    console.log('======================================================');
    console.log('🚨 RESULT: FAIL');
    console.log('One or more required sections or critical facts were missing.');
    console.log('======================================================\n');
    console.log('Full Output for Debugging:');
    console.log('------------------------------------------------------');
    console.log(fullOutput);
    console.log('------------------------------------------------------\n');
    process.exit(1);
  }
}

runSmokeTest();
